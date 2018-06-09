'use strict';

import * as vscode from 'vscode';
const { copy, paste } = require('copy-paste');

let config = vscode.workspace.getConfiguration('indentOnPaste');
let editor = vscode.window.activeTextEditor;
let clipboardPasteActionCommand:vscode.Disposable = null;
let extension: vscode.ExtensionContext = null;

let indentOnPaste = () =>
{
	//TODO: instead of manually pasting, use the paste command (to retain format on paste and such)...
	// console.log("PASTE");
	// clipboardPasteActionCommand.dispose();

	// vscode.commands.executeCommand('editor.action.clipboardPasteAction').then(() =>
	// {
	// 	console.log("DONE");
	// 	clipboardPasteActionCommand = vscode.commands.registerCommand('editor.action.clipboardPasteAction', indentOnPaste);
	// 	extension.subscriptions.push(clipboardPasteActionCommand);
	// });

	//get the line we will be pasting on...
	let pasteOnLineNumber = editor.selection.end.line;
	let pasteOnLine: string = editor.document.lineAt(pasteOnLineNumber).text;
	let pasteOnBlankLine: boolean = (pasteOnLine.search(/\S/) == -1);

	//find the next line that is not blank, which we will inspect to determine how much indentation is needed...
	let inspectLine: string = "";
	for(let i = pasteOnLineNumber + 1; i < editor.document.lineCount; i++)
	{
		if (editor.document.lineAt(i).text.search(/\S/) > -1)
		{
			inspectLine = editor.document.lineAt(i).text;
			break;
		}
	}

	//count the indentations on the inspection line...
	let indentationsNeeded = countIndents(inspectLine);

	//if the inspection line is an ending block, increase the indentation by 1...
	let inspection = inspectLine.toLowerCase().replace(/\s/g, ''); //lowercase and remove all whitespace
	let isEndingBlock = false;
	(config.get('endingBlocks') as Array<string>).forEach((endingBlock)=>{
		if (inspection.startsWith(endingBlock.toLowerCase()))
		{
			isEndingBlock = true;
		}
	});
	if (isEndingBlock) indentationsNeeded++;

	//get the clipboard contents and redo the indentations...
	let clipboard: string = getClipboard();
	let lines = clipboard.split("\n");

	//just abort if there's nothing on the clipboard...
	if (lines.length == 0)
		return;

	//only re-indent the clipboard if it has multiple lines or we're pasting to a blank line...
	let x = 0;
	if (lines.length > 1 || pasteOnBlankLine)
	{
		//determine the desired indentation level by finding the least indented non-blank line
		//(skip the first line, which could have been copied without its indentation)...
		let currentLineIndents = 0;
		let desiredIndentation = 99999;
		for (x = 1; x < lines.length; x++)
		{
			if (lines[x].search(/\S/) > -1)
			{
				currentLineIndents = countIndents(lines[x]);
				if (currentLineIndents < desiredIndentation)
					desiredIndentation = currentLineIndents;
			}
		}

		//if the first line is not blank (and we're pasting to a blank line), let's assume its indentation should match the desired indentation...
		if (lines[0].search(/\S/) > -1 && pasteOnBlankLine)
		{
			lines[0] = setIndents(lines[0], desiredIndentation);
		}

		//redo the indentations...
		clipboard = "";
		for (x = 0; x < lines.length; x++)
		{
			if (x > 0) clipboard += "\n";

			//don't re-indent the first line if we're pasting on a non-empty line...
			if (pasteOnBlankLine || x > 0)
			{
				//don't re-indent blank lines...
				if (lines[x].search(/\S/) > -1)
				{
					lines[x] = setIndents(lines[x], (countIndents(lines[x]) - desiredIndentation) + indentationsNeeded);
				}
			}

			clipboard += lines[x];
		}
	}

	//replace whatever's currently selected with the modified clipboard contents...
	editor.edit((textInserter) => {
		//if we're pasting on a blank line, start replacing at the very beginning of the line (replace current indentation)...
		if (pasteOnBlankLine)
			textInserter.replace(new vscode.Selection(editor.selection.start.line, 0, editor.selection.end.line, editor.selection.end.character), clipboard);
		else
			textInserter.replace(editor.selection, clipboard);
	});

	//move cursor to end of pasted content (and unselect previous selection)...
	if (!pasteOnBlankLine && lines.length == 1)
		editor.selection = new vscode.Selection(editor.selection.start.line + lines.length - 1, editor.selection.start.character + lines[lines.length - 1].length, editor.selection.start.line + lines.length - 1, editor.selection.start.character + lines[lines.length - 1].length);
	else
		editor.selection = new vscode.Selection(editor.selection.start.line + lines.length - 1, lines[lines.length - 1].length, editor.selection.start.line + lines.length - 1, lines[lines.length - 1].length);
}

export function getClipboard()
{
	return paste();
}

export function countIndents(str:string)
{
	let indents = 0;
	let spaces = 0;
	for(let x = 0; x < str.length; x++)
	{
		if (str.charAt(x).search(/\S/) > -1) break;
		if (str.charAt(x) == " ")
		{
			spaces++;
			if (spaces >= editor.options.tabSize)
			{
				indents++;
				spaces = 0;
			}
		}
		else if (str.charAt(x) == "\t")
		{
			indents++;
			spaces = 0;
		}
	}

	return indents;
}

export function setIndents(str:string, indents:number)
{
	let indent:string = "\t";
	if (editor.options.insertSpaces)
	{
		indent = "";
		for (let x = 0; x < editor.options.tabSize; x++)
			indent += " ";
	}

	str = str.replace(/^\s+/g, ''); //trim leading whitespace
	for(let x:number = 0; x < indents; x++)
		str = indent + str;

	return str;
}

export function activate(context: vscode.ExtensionContext) {
	extension = context;
	clipboardPasteActionCommand = vscode.commands.registerCommand('editor.action.clipboardPasteAction', indentOnPaste)
	extension.subscriptions.push(clipboardPasteActionCommand);
}

export function deactivate() {
}
