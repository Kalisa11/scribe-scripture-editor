import localforage from 'localforage';
import { splitStringByLastOccurance } from '@/util/splitStringByLastMarker';
import * as logger from '../../logger';
import { environment } from '../../../environment';
import packageInfo from '../../../../package.json';
import { newPath, supabaseStorage } from '../../../../supabase';
import { isElectron } from '../handleElectron';

export const updateAgSettings = async (username, projectName, data) => {
  logger.debug('updateAgSettings.js', 'In updateAgSettings');
  const newpath = localStorage.getItem('userPath');
  const fs = window.require('fs');
  const path = require('path');
  const result = Object.keys(data.ingredients).filter((key) => key.includes(environment.PROJECT_SETTING_FILE));
  const folder = path.join(newpath, packageInfo.name, 'users', username, 'projects', projectName, result[0]);
  const settings = await fs.readFileSync(folder, 'utf8');
  const setting = JSON.parse(settings);
  if (settings.version !== environment.AG_SETTING_VERSION) {
    setting.version = environment.AG_SETTING_VERSION;
    if (!setting.sync && !setting.sync?.services) {
      setting.sync = { services: { door43: [] } };
    } else {
      setting.sync.services.door43 = setting?.sync?.services?.door43 ? setting?.sync?.services?.door43 : [];
    }
  }
  setting.project[data.type.flavorType.flavor.name] = data.project[data.type.flavorType.flavor.name];
  logger.debug('updateAgSettings.js', `Updating the ${environment.PROJECT_SETTING_FILE}`);
  await fs.writeFileSync(folder, JSON.stringify(setting));
};

export const updateWebAgSettings = async (username, projectName, data) => {
  const result = Object.keys(data.ingredients).filter((key) => key.includes(environment.PROJECT_SETTING_FILE));
  const folder = `${newPath}/${username}/projects/${projectName}/${result[0]}`;
  const { data: settings } = await supabaseStorage().download(folder);
  let setting = {};
  setting = JSON.parse(await settings.text());
  if (settings.version !== environment.AG_SETTING_VERSION) {
    setting.version = environment.AG_SETTING_VERSION;
    if (!setting.sync && !setting.sync?.services) {
      setting.sync = { services: { door43: [] } };
    } else {
      setting.sync.services.door43 = setting?.sync?.services?.door43 ? setting?.sync?.services?.door43 : [];
    }
  }
  setting.project[data.type.flavorType.flavor.name] = data.project[data.type.flavorType.flavor.name];
  await supabaseStorage().upload(folder, JSON.stringify(setting), {
    // cacheControl: '3600',
    upsert: true,
  });
};

export const saveReferenceResource = () => {
  logger.debug('updateAgSettings.js', 'In saveReferenceResource for saving the reference data');
  localforage.getItem('currentProject').then(async (projectName) => {
    const _projectname = await splitStringByLastOccurance(projectName, '_');
    // const _projectname = projectName?.split('_');
    localforage.getItem('projectmeta').then((value) => {
      Object.entries(value).forEach(
        ([, _value]) => {
          Object.entries(_value).forEach(
            ([, resources]) => {
              if (resources.identification.name.en === _projectname[0]) {
                localforage.getItem('userProfile').then(async (value) => {
                  if (isElectron()) {
                    await updateAgSettings(value?.username, projectName, resources);
                  } else {
                    await updateWebAgSettings(value?.user?.email, projectName, resources);
                  }
                });
              }
            },
          );
        },
      );
    });
  });
};
