/*
 * cloudbeaver - Cloud Database Manager
 * Copyright (C) 2020 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { AdministrationScreenService } from '@cloudbeaver/core-administration';
import { UsersResource } from '@cloudbeaver/core-authentication';
import { injectable } from '@cloudbeaver/core-di';
import { NotificationService } from '@cloudbeaver/core-events';
import { IExecutor, Executor } from '@cloudbeaver/core-executor';
import { ServerConfigResource } from '@cloudbeaver/core-root';
import { GraphQLService, ServerConfig } from '@cloudbeaver/core-sdk';

import { IServerConfigurationPageState } from './IServerConfigurationPageState';

export interface IValidationStatusContext {
  getState: () => boolean;
  invalidate: () => void;
}

@injectable()
export class ServerConfigurationService {

  state: IServerConfigurationPageState;
  readonly validationTask: IExecutor<boolean>;

  constructor(
    private readonly administrationScreenService: AdministrationScreenService,
    private readonly serverConfigResource: ServerConfigResource,
    private readonly graphQLService: GraphQLService,
    private readonly notificationService: NotificationService,
    private readonly usersResource: UsersResource
  ) {
    this.state = this.administrationScreenService
      .getItemState(
        'server-configuration',
        () => this.getConfig(),
      );
    this.validationTask = new Executor();
  }

  async loadConfig() {
    const config = await this.serverConfigResource.load(null);

    this.state = this.administrationScreenService
      .getItemState(
        'server-configuration',
        () => this.getConfig(config),
        !config?.configurationMode
      );
  }

  isDone(): boolean {
    return this.isFormFilled();
  }

  async validate(): Promise<boolean> {
    const context = await this.validationTask.execute(true);
    const state = await context.getContext(this.validationStatusContext);

    return state.getState();
  }

  validationStatusContext = (): IValidationStatusContext => {
    let state = this.isFormFilled();

    const invalidate = () => {
      state = false;
    };
    const getState = () => state;

    return {
      getState,
      invalidate,
    };
  };

  async apply(): Promise<void> {
    if (!this.state) {
      throw new Error('No state available');
    }

    try {
      await this.graphQLService.sdk.setDefaultNavigatorSettings({ settings: this.state.navigatorConfig });
      await this.graphQLService.sdk.configureServer({ configuration: this.state.serverConfig });

      if (!this.serverConfigResource.data?.configurationMode) {
        await this.serverConfigResource.refresh(null);
      }
      this.usersResource.refreshAllLazy();
    } catch (exception) {
      this.notificationService.logException(exception, 'Can\'t save server configuration');

      throw exception;
    }
  }

  private isFormFilled() {
    if (!this.state?.serverConfig.serverName) {
      return false;
    }
    if (this.administrationScreenService.isConfigurationMode) {
      if (!this.state.serverConfig.adminName
      || this.state.serverConfig.adminName.length < 6
      || !this.state.serverConfig.adminPassword
      ) {
        return false;
      }
    }
    return true;
  }

  private getConfig(config?: ServerConfig | null): IServerConfigurationPageState {
    if (!config || config?.configurationMode) {
      return {
        serverConfig: {
          serverName: 'CloudBeaver',
          adminName: 'cbadmin',
          adminPassword: '',
          anonymousAccessEnabled: true,
          authenticationEnabled: false,
          customConnectionsEnabled: false,
        },
        navigatorConfig: {
          hideFolders: false,
          hideSchemas: false,
          hideVirtualModel: false,
          mergeEntities: false,
          showOnlyEntities: false,
          showSystemObjects: false,
          showUtilityObjects: false,
        },
      };
    }

    return {
      serverConfig: {
        serverName: config.name,
        anonymousAccessEnabled: config.anonymousAccessEnabled,
        authenticationEnabled: config.authenticationEnabled,
        customConnectionsEnabled: config.supportsCustomConnections,
      },
      navigatorConfig: {
        hideFolders: false,
        hideSchemas: false,
        hideVirtualModel: false,
        mergeEntities: false,
        showOnlyEntities: false,
        showSystemObjects: false,
        showUtilityObjects: false,
      },
    };
  }

}