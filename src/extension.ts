import * as vsc from "vscode";
import { read as readMat } from "mat-for-js";
import { contributes } from "../package.json";

export function activate(context: vsc.ExtensionContext) {
  context.subscriptions.push(
    vsc.window.registerCustomEditorProvider(
      contributes.customEditors[0].viewType,
      new MatFileEditor(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );
  console.log("vsc-mat init done!");
}

// This method is called when your extension is deactivated
export function deactivate() {}

class MatDocument implements vsc.CustomDocument {
  readonly data: Promise<ReturnType<typeof readMat>>;
  constructor(public readonly uri: vsc.Uri) {
    this.data = this.init(uri);
  }
  private async init(uri: vsc.Uri) {
    const file = await vsc.workspace.fs.readFile(uri);
    return readMat(file.buffer);
  }
  dispose(): void {}
}

class MatFileEditor implements vsc.CustomReadonlyEditorProvider<MatDocument> {
  constructor(private context: vsc.ExtensionContext) {}

  openCustomDocument(uri: vsc.Uri): MatDocument {
    return new MatDocument(uri);
  }

  async resolveCustomEditor(
    document: MatDocument,
    webviewPanel: vsc.WebviewPanel,
    _token: vsc.CancellationToken
  ): Promise<void> {
    console.info(this.context);
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = await this.getHtmlForWebview(document);
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message === "preview") {
        const data = await document.data,
          doc = await vsc.workspace.openTextDocument({
            language: "json",
            content: JSON.stringify(data, null, 2),
          });
        vsc.window.showTextDocument(doc);
      }
    });
  }

  private async getHtmlForWebview(mat: MatDocument) {
    const data = await mat.data;
    return `
			<!DOCTYPE html>
			<html lang="en">
      <head>
        <style>
          table {
              width: 100%;
              border-collapse: collapse;
          }
          table, th, td {
              border: 1px solid gray;
          }
          th, td {
              padding: 10px;
              text-align: left;
              position: relative;
          }
          #preview {
              color: var(--vscode-button-foreground);
              background-color: var(--vscode-button-background);
              border: none;
              padding: 5px 10px;
          }
          #preview:hover {
              color: var(--vscode-button-hoverForeground);
              background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <p>
          <button id="preview">Preview as JSON</button>
          <span>${data.header}</span>
        </p>
        <div>${this.renderTable(data.data)}</div>
        <script>
          const vscode = acquireVsCodeApi();
          document.getElementById('preview').addEventListener('click', () => {
            vscode.postMessage('preview');
          });
        </script>
      </body>
      </html>
    `;
  }

  private renderTable(data: any): string {
    console.info(data);
    return `
      <table>
        <tr>
          <th>Variable</th>
          <th>Size</th>
          <th>Type</th>
          <th>Value</th>
        </tr>
        ${Object.entries(data)
          .map(([key, value]) => {
            return `
              <tr>
                <td>${key}</td>
                ${this.renderVariable(value)}
              </tr>
            `;
          })
          .join("")}
      </table>
    `;
  }

  private renderVariable(variable: any): string {
    if (Array.isArray(variable)) {
      return this.renderArray(variable);
    } else if (typeof variable === "string") {
      return `<td>${variable.length}</td><td>string</td><td>${variable}</td>`;
    } else if (typeof variable === "number") {
      return `<td>1</td><td>number</td><td>${variable}</td>`;
    } else if (typeof variable === "object") {
      return `<td>${variable.length}</td><td>object</td><td>${JSON.stringify(
        variable
      )}</td>`;
    } else {
      return `<td>1</td><td>unknown</td><td>${variable}</td>`;
    }
  }

  private renderArray(arr: any[]): string {
    if (!arr.length) {
      return "<td>0</td><td></td><td>[]</td>";
    } else if (arr.length === 1) {
      return `
        <td>1</td>
        <td>${typeof arr[0]}</td>
        <td>${JSON.stringify(arr[0])}</td>
      `;
    } else if (typeof arr[0] === "object") {
      return `
        <td>${arr.length}</td>
        <td>complex</td>
        <td>...</td>
      `;
    }
    return `
      <td>${arr.length}</td>
      <td>${typeof arr[0]}</td>
      <td>[${arr.join(", ")}]</td>
    `;
  }
}
