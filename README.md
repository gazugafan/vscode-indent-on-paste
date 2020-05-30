# Indent on Paste for Visual Studio Code

Attempts to re-indent code before it is pasted, using some generalized indentation rules. This was inspired by, but completely separate from [Paste and Indent by Rubymaniac](https://github.com/rubymaniac/vscode-paste-and-indent).

## Another Paste and Indent extension?
Rubymaniac's extension is awesome, but it selects and reformats code after it has been pasted in. This seems to have led to some weird bugs where bits of code are left selected after pasting. This extension takes a different approach by modifying the clipboard contents *before* it is pasted (and then immediately restores the original clipboard contents aftewards).

I also wanted to clean up the re-indentation algorithm. This extension looks for something resembling a "closing block" on the line following the target location (things like closing braces, closing tags, and PHP template endif's). Closing braces are easier to detect in a universal language-agnostic way, and this lets me indent the pasted code accordingly.

Finally, this extension doesn't rely on remapping the Ctrl+V keybinding. Instead, it hijacks VS Code's native paste command. So, after installing it should just work--no matter how you paste. Ctrl+V, Edit > Paste, Right Click > Paste. It should all just work!

## Install

Via Quick Open:

1. [Download](https://code.visualstudio.com/download), install and open VS Code
2. Press `cmd+p` to open the Quick Open dialog
3. Type `ext install indent-on-paste`
4. Click the *Install* button, then the *Enable* button

Via the Extensions tab:

1. Click the extensions tab or press `cmd+shift+x`
2. Search for *indent on paste*
3. Click the *Install* button, then the *Enable* button

Via the command line:

1. Open a command-line prompt
2. Run `code --install-extension gazugafan.vscode-indent-on-paste`

## Usage

Just paste like normal! No need to change keybindings or anything.


## Configuration
### `indentOnPaste.endingBlocks`
Use this setting to change what ending blocks we look for. Whenever you paste code above an ending block, the code will be indented one level deeper (so it sits inside that block).

When determining whether a line of code is an ending block or not, we strip out all whitespace, and we only check that the line begins that way. For example, `</` should match any closing tag pretty well (`</div>`, `</span>`, etc all start with `</`), and `<?phpend` would match closing PHP template endif's, endfor's, etc (`<?php endif?>`, `<?php endforeach?>`, etc).

### `indentOnPaste.pasteMethod`
Use this setting to change how pasted text is actually inserted into the document. `native` (the default) uses VS Code's built-in pasting method. This allows other pasting functionality to continue working like normal (such as "editor.formatOnPaste"). If you find that other pasting functionality conflicts with this, though, you can change this setting to `workaround` to completely bypass VS Code's built-in pasting method.

## Limitations

* Pasting code that immediately begins with a line at the lowest level of indentation, and does NOT include any other lines at this level, will be problematic. For example, consider the following...
```ts
if (1)
{
	if (2)
		console.log("test");
}
```
...if you were to select the code starting with the `if (2)` line--NOT including the line above it, along with the following console.log line, it will get pasted as...
```ts
if (2)
console.log("test")
```
This is because we can't rely on the first line of code to have been selected with its indentation included. You could have started the selection right at the `if`, or you could have started it before the indentation. Without other lines at this indentation level, we can't be sure what the desired indentation is. To workaround this issue, just be sure to include the return from the line above. In this case, you would want to start your selection after the opening `{` to include the return above the `if (2)`.

Note that this wouldn't be a problem if there were braces around the `console.log`, like this...
```ts
if (1)
{
	if (2)
	{
		console.log("test");
	}
}
```
...in that case you would likely be copying the braces as well, resulting in other lines besides the first at the same indentation level. Really, this is mainly going to be a problem with languages that rely on indentation for their structure, such as Python.

## Contribute

* For any bugs and feature requests please open an issue. For code contributions please create a pull request. Enjoy!
* **Note to self:** To publish, run ```vsce publish``` **FROM WSL**. Otherwise, Linux permissions for the embedded ```xsel``` binary will be lost.

## LICENSE

MIT License

Copyright (c) gazugafan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
