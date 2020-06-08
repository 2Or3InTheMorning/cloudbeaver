/*
 * cloudbeaver - Cloud Database Manager
 * Copyright (C) 2020 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import {
  EObjectFeature, NavNodeManagerService, IContextProvider, INodeNavigationData
} from '@dbeaver/core/app';
import { ITab } from '@dbeaver/core/blocks';
import { injectable } from '@dbeaver/core/di';
import { NotificationService } from '@dbeaver/core/eventsLog';
import { ObjectViewerTabService } from '@dbeaver/object-viewer-plugin';

import { ddlViewer } from './DdlViewer/DdlViewer';
import { DdlViewerService } from './DdlViewerService';

const ddlViewerTabId = 'ddl-viewer';

@injectable()
export class DdlViewerTabService {

  constructor(
    private navNodeManagerService: NavNodeManagerService,
    private objectViewerTabService: ObjectViewerTabService,
    private notificationService: NotificationService,
    private ddlViewerService: DdlViewerService
  ) {
    this.navNodeManagerService.navigator.addHandler(this.navigationHandler.bind(this));
  }

  buildTab(nodeId: string): ITab | null {
    const node = this.navNodeManagerService.getNode(nodeId);
    const isDdlRequired = node?.objectFeatures.includes(EObjectFeature.script);
    if (!isDdlRequired) {
      return null;
    }
    const ddlTab: ITab = {
      tabId: ddlViewerTabId,
      title: 'DDL',
      icon: 'sql-text',
      onActivate: () => this.activateDDLTab(nodeId, node?.parentId!),
      panel: () => ddlViewer(nodeId),
    };
    return ddlTab;
  }

  private async navigationHandler(contexts: IContextProvider<INodeNavigationData>) {
    try {
      const tabContext = await contexts.getContext(this.objectViewerTabService.objectViewerTabContext);

      if (tabContext.nodeInfo.folderId === ddlViewerTabId) {
        this.ddlViewerService.loadDdlMetadata(tabContext.nodeInfo.nodeId);
      }
    } catch (exception) {
      this.notificationService.logException(exception, 'Error in Object Viewer while processing action with ddl-viewer');
    }
  }

  private activateDDLTab(nodeId: string, parentId: string) {
    this.navNodeManagerService.navToNode(nodeId, parentId, ddlViewerTabId);
  }
}
