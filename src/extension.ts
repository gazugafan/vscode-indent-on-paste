'use strict';

import * as vscode from 'vscode';
const clipboardy = require('clipboardy');

let config = vscode.workspace.getConfiguration('indentOnPaste');
let clipboardPasteActionCommand:vscode.Disposable = null;
let extension: vscode.ExtensionContext = null;
let pasting:boolean = false;

let indentOnPaste = () =>
{
	if (pasting)
		return;

	pasting = true;

	try
	{
		//get the clipboard contents...
		let clipboard: string = getClipboard();
		let originalClipboard:string = clipboard;
		let lines = clipboard.split("\n");
		//let clipboardEndsWithReturn:boolean = lines[lines.length - 1].search(/\S/) == -1;

		//get the line we will be pasting on...
		let editor = vscode.window.activeTextEditor;
		let pasteOnLineNumber = editor.selection.start.line;
		let pasteOnLine: string = editor.document.lineAt(pasteOnLineNumber).text;
		let beforePastePosition:string = pasteOnLine.substr(0, editor.selection.start.character);
		let pasteOnBlankLine: boolean = (beforePastePosition.search(/\S/) == -1);

		//find the next line that is not blank, which we will inspect to determine how much indentation is needed...
		let inspectLine: string = "";
		for(let i = editor.selection.end.line + 1; i < editor.document.lineCount; i++)
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

		if (config.get('pasteMethod') == "workaround")
		{
			//replace whatever's currently selected with the modified clipboard contents...
			editor.edit((textInserter) => {
				//if we're pasting on a blank line, start replacing at the very beginning of the line (replace current indentation)...
				if (pasteOnBlankLine)
					textInserter.replace(new vscode.Selection(editor.selection.start.line, 0, editor.selection.end.line, editor.selection.end.character), clipboard);
				else
					textInserter.replace(editor.selection, clipboard);
			}).then(()=>{
				//unselect selection...
				editor.selection = new vscode.Selection(editor.selection.end.line, editor.selection.end.character, editor.selection.end.line, editor.selection.end.character);
				pasting = false;
			}, ()=>{pasting = false;});
		}
		else
		{
			//replace the clipboard contents with the modified version...
			clipboardy.write(clipboard).then(()=>{

				//if we're pasting onto a blank line, be sure to extend the selection to the very beginning of the blank line (to replace any existing indentation)...
				if (pasteOnBlankLine)
					editor.selection = new vscode.Selection(editor.selection.start.line, 0, editor.selection.end.line, editor.selection.end.character);

				//after the clipboard has been updated, call VS Code's native paste command.
				//We need to remove our event handler for this first so we don't cause infinite recursion, and then add it back in afterwards...
				clipboardPasteActionCommand.dispose();
				vscode.commands.executeCommand('editor.action.clipboardPasteAction').then(() => {
					clipboardPasteActionCommand = vscode.commands.registerTextEditorCommand('editor.action.clipboardPasteAction', indentOnPaste);
					extension.subscriptions.push(clipboardPasteActionCommand);

					//restore the unmodified version of the clipboard...
					clipboardy.writeSync(originalClipboard);
					pasting = false;
				}, ()=>{pasting = false;});
			}, ()=>{pasting = false;});
		}
	}
	catch(e)
	{
		pasting = false;
		console.log("Error pasting...", e);
	}
}

export function getClipboard()
{
	return clipboardy.readSync();
}

export function countIndents(str:string)
{
	let editor = vscode.window.activeTextEditor;
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
	let editor = vscode.window.activeTextEditor;
	
	//if multi-cursor is active we do not indent
	if (editor.selections.length > 1) return str;

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
	clipboardPasteActionCommand = vscode.commands.registerTextEditorCommand('editor.action.clipboardPasteAction', indentOnPaste)
	extension.subscriptions.push(clipboardPasteActionCommand);
}

export function deactivate() {
}
