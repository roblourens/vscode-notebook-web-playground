import * as vscode from 'vscode';

interface IWebBookCell {
	language: WebBookLanguage;
	source: string;
}

interface IWebBookData {
	cells: IWebBookCell[];
}

type WebBookLanguage = 'html' | 'css' | 'javascript' | 'markdown';
const WEB_BOOK_LANGUAGES: WebBookLanguage[] = ['html', 'css', 'javascript', 'markdown'];

export class WebBookProvider implements vscode.NotebookContentProvider {
	constructor() {
		// vscode.notebook.onDidChangeNotebookCells(e => {
		// 	this.executeCell(e.document, undefined);
		// });
	}

	async openNotebook(uri: vscode.Uri): Promise<vscode.NotebookData> {
		const buffer = await vscode.workspace.fs.readFile(uri);
		const contents = buffer.toString();
		if (!contents) {
			return this.getNewNotebook();
		}

		const data: IWebBookData = JSON.parse(contents);
		const cells: vscode.NotebookCellData[] = data.cells.map(cell => {
			return {
				cellKind: cell.language === 'markdown' ? vscode.CellKind.Markdown : vscode.CellKind.Code,
				language: cell.language,
				metadata: {
					editable: true,
					runnable: true
				},
				outputs: [],
				source: cell.source
			};
		});

		return {
			cells,
			languages: WEB_BOOK_LANGUAGES,
			metadata: {
				cellEditable: true,
				cellRunnable: true,
				editable: true
			}
		};
	}

	private getDocumentParts(document: vscode.NotebookDocument): vscode.NotebookCell[][] {
		const parts: vscode.NotebookCell[][] = [];
		let currentPart: vscode.NotebookCell[] = [];

		document.cells.forEach(cell => {
			currentPart.push(cell);
			if (cell.language === 'html') {
				parts.push(currentPart);
				currentPart = [];
			}
		});

		return parts;
	}

	private async executeNotebook(document: vscode.NotebookDocument): Promise<void> {
		const parts = this.getDocumentParts(document);
		await Promise.all(parts.map(part => this.executePart(part)));
	}

	private async executePart(part: vscode.NotebookCell[]): Promise<void> {
		const allJS = part.filter(cell => cell.language === 'javascript')
			.map(cell => cell.source)
			.join('\n');
		const allCSS = part.filter(cell => cell.language === 'css')
			.map(cell => cell.source)
			.join('\n');

		// Should be just one html cell
		const htmlCells = part.filter(cell => cell.language === 'html');
		if (htmlCells.length > 1) {
			throw new Error('Each part should have 1 html cell');
		}

		const htmlCell = htmlCells[0];
		const htmlSource = htmlCell.source;

		const logId = 'logoutput_' + Math.floor(Math.random() * 1000);
		const combinedHtml = `
<html>
<style>
${allCSS}
</style>

<script>
(() => {
	if (!window.originalLog) {
		window.originalLog = console.log.bind(console);
	}

	console.log = (...args) => {
		const logRow = document.createElement('div');
		logRow.textContent = args.join(' ');
		document.querySelector('#${logId}').appendChild(logRow);
		window.originalLog.apply(args);
	}

	${allJS}
})();
</script>

${htmlSource}

</html>
		`;

		const logOutputContainer = `<div style="max-height: 300px; overflow: scroll" id="${logId}"></div>`;

		// const injectionScript = `<iframe style="border: none; height: 100%; width: 100%" src="data:text/html;charset=utf-8,${encodeURI(combinedHtml)}">`;
		htmlCell.outputs = [
			{
				outputKind: vscode.CellOutputKind.Rich,
				data: {
					'text/html': combinedHtml
				}
			},
			{
				outputKind: vscode.CellOutputKind.Rich,
				data: {
					'text/html': logOutputContainer
				}
			}
		];
	}

	async executeCell(document: vscode.NotebookDocument, cell: vscode.NotebookCell | undefined, token?: vscode.CancellationToken): Promise<void> {
		if (!cell) {
			return this.executeNotebook(document);
		}

		const parts = this.getDocumentParts(document);
		parts.forEach(part => {
			if (part.includes(cell)) {
				this.executePart(part);
			}
		});
	}

	private getNewNotebook(): vscode.NotebookData {
		return {
			cells: [
				{
					cellKind: vscode.CellKind.Code,
					language: 'javascript',
					metadata: { },
					outputs: [],
					source: 'document.querySelector(\'.blah\').textContent = \'Hello, notebook!\''
				},
				{
					cellKind: vscode.CellKind.Code,
					language: 'css',
					metadata: {},
					outputs: [],
					source: '.blah {\n  color: red;\n}'
				},
				{
					cellKind: vscode.CellKind.Code,
					language: 'html',
					metadata: {},
					outputs: [],
					source: '<span class="blah"></span>'
				},
			],
			metadata: {},
			languages: WEB_BOOK_LANGUAGES,
		};
	}

	async saveNotebook(document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
		const cells: IWebBookCell[] = document.cells.map(cell => {
			return {
				source: cell.source,
				language: cell.language as WebBookLanguage
			};
		});

		const data: IWebBookData = { cells };
		await vscode.workspace.fs.writeFile(document.uri, new Buffer(JSON.stringify(data, undefined, 2)));

		await this.executeNotebook(document);
	}

	saveNotebookAs(targetResource: vscode.Uri, document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
		throw new Error("Method not implemented.");
	}

	readonly onDidChangeNotebook = new vscode.EventEmitter<vscode.NotebookDocumentEditEvent>().event;
}