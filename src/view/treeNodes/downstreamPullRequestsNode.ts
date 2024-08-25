/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import Logger, { PR_TREE } from '../../common/logger';
import { FolderRepositoryManager } from '../../github/folderRepositoryManager';
import { PullRequestModel } from '../../github/pullRequestModel';
import { CommitNode } from './commitNode';
import { TreeNode, TreeNodeParent } from './treeNode';
import { PRType } from '../../github/interface';
import { PRNode } from './pullRequestNode';
import { NotificationProvider } from '../../github/notifications';
import { RepositoriesManager } from '../../github/repositoriesManager';
import { PullRequestsTreeDataProvider } from '../prsTreeDataProvider';

export class DownstreamPullRequestsNode extends TreeNode implements vscode.TreeItem {
	public label: string = vscode.l10n.t('Downstream Pull Requests');
	public collapsibleState: vscode.TreeItemCollapsibleState;
	private _folderRepoManager: FolderRepositoryManager;
	private _pr: PullRequestModel;
	private notificationProvider: NotificationProvider;

	constructor(
		parent: TreeNodeParent,
		reposManager: FolderRepositoryManager,
		pr: PullRequestModel,
		_pullReuestsTreeDataProvider: PullRequestsTreeDataProvider,
	) {
		super();
		this.parent = parent;
		this._pr = pr;
		this._folderRepoManager = reposManager;
		this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

		this.childrenDisposables = [];
		this.childrenDisposables.push(this._pr.onDidChangeReviewThreads(() => {
			Logger.appendLine(`Review threads have changed, refreshing Commits node`, PR_TREE);
			this.refresh(this);
		}));
		this.childrenDisposables.push(this._pr.onDidChangeComments(() => {
			Logger.appendLine(`Comments have changed, refreshing Commits node`, PR_TREE);
			this.refresh(this);
		}));
		const _reposManager = new RepositoriesManager(reposManager.credentialStore, reposManager.telemetry);
		this.notificationProvider = new NotificationProvider(_pullReuestsTreeDataProvider, reposManager.credentialStore, _reposManager);
	}

	getTreeItem(): vscode.TreeItem {
		return this;
	}

	async getChildren(): Promise<TreeNode[]> {
		super.getChildren();
		try {
			const head = this._pr.head;
			if (!head) {
				Logger.appendLine(`No head found for PR, returning empty array`, PR_TREE);
				return [];
			}
			Logger.appendLine(`Getting Downstream PRs for DownstreamPullRequests node`, PR_TREE);
			const allPullRequests: PullRequestModel[] = [];
			const pullRequests = await this._folderRepoManager.getPullRequests(
				PRType.Query,
				{ fetchNextPage: false },
				// eslint-disable-next-line no-template-curly-in-string, no-useless-concat
				'is:open repo:${owner}/${repository}' + ` base:${head.ref}`,
			);
			pullRequests.items.forEach(pr => {
				if (pr.number !== this._pr.number) {
					allPullRequests.push(pr);
				}
			});

			this.children = allPullRequests.map(
				pullRequest => new PRNode(this, this._folderRepoManager, pullRequest, false, this.notificationProvider));

			Logger.appendLine(`Got all children for Commits node`, PR_TREE);
			return this.children;
		} catch (e) {
			return [];
		}
	}
}
