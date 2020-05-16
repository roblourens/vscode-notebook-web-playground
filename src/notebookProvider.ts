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
	async openNotebook(uri: vscode.Uri): Promise<vscode.NotebookData> {
		const buffer = await vscode.workspace.fs.readFile(uri);
		const contents = buffer.toString();
		if (!contents) {
			return this.getNewNotebook();
		}

		const data: IWebBookData = JSON.parse(contents);
		const cells: vscode.NotebookCellData[] = data.cells.map(cell => {
			return <vscode.NotebookCellData>{
				cellKind: cell.language === 'markdown' ? vscode.CellKind.Markdown : vscode.CellKind.Code,
				language: cell.language,
				metadata: {
					editable: true,
					runnable: true
				},
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

	async executeCell(document: vscode.NotebookDocument, cell: vscode.NotebookCell | undefined, token: vscode.CancellationToken): Promise<void> {
		const allJS = document.cells.filter(cell => cell.language === 'javascript')
			.map(cell => cell.source)
			.join('\n');
		const allCSS = document.cells.filter(cell => cell.language === 'css')
			.map(cell => cell.source)
			.join('\n');

		const combinedHtml = `
<html>
<style>
${allCSS}
</style>

<script>
${allJS}
</script>

${cell!.source}
</html>
		`;

		cell!.outputs = [
			{
				outputKind: vscode.CellOutputKind.Rich,
				data: {
					'text/html': combinedHtml
				}
			}
		];
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
		await vscode.workspace.fs.writeFile(document.uri, new Buffer(JSON.stringify(data)));
	}

	saveNotebookAs(targetResource: vscode.Uri, document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
		throw new Error("Method not implemented.");
	}

	readonly onDidChangeNotebook = new vscode.EventEmitter<vscode.NotebookDocumentEditEvent>().event;
}