import * as vscode from 'vscode';
import { WebBookProvider } from './notebookProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.notebook.registerNotebookContentProvider('web-playground', new WebBookProvider()));
}

export function deactivate() {}
