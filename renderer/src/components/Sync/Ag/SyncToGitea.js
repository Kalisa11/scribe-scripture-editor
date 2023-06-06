import * as localForage from 'localforage';
import { environment } from 'environment';
import * as logger from '../../../logger';
import {
 handleCreateRepo, createFiletoServer, updateFiletoServer, getOrPutLastSyncInAgSettings,
} from './SyncToGiteaUtils';
import packageInfo from '../../../../../package.json';
import { checkInitialize, commitChanges, initProject } from '../Isomorphic/utils';
import { createRepo } from '../Isomorphic/api';
// upload project to gitea main function
export async function uploadToGitea(projectDataAg, auth, setSyncProgress, notifyStatus, addNotification) {
  logger.debug('ToGiteaUtils.js', 'in uploadTOGitea');
  const projectData = projectDataAg.projectMeta;
  const projectId = Object.keys(projectData.identification.primary[packageInfo.name])[0];
  const projectName = projectData.identification.name.en;
  const ingredientsObj = projectData.ingredients;
  const projectCreated = projectData.meta.dateCreated.split('T')[0];
  const repoName = `${projectData.languages[0].tag}-${projectData.type.flavorType.flavor.name}-${projectName.replace(/[\s+ -]/g, '_')}`;
  // const repo = { name: `${projectData.languages[0].tag}-${projectData.type.flavorType.flavor.name}-${projectName.replace(/[\s+ -]/g, '_')}`, owner: { username: dcsOwners.length > 0 ? dcsOwners[0].username : auth.user.username } };
  const branch = `${auth?.user?.username}/${packageInfo.name}`;
  localForage.getItem('userProfile').then(async (user) => {
    const newpath = localStorage.getItem('userPath');
    const fs = window.require('fs');
    const path = require('path');
    const projectsMetaPath = path.join(newpath, packageInfo.name, 'users', user?.username, 'projects', `${projectName}_${projectId}`);
    setSyncProgress((prev) => (
      {
        ...prev,
        totalFiles: Object.keys(ingredientsObj).length,
      }
    ));
    // Create A REPO for the project
    try {
      // Check whether the project is git initiallized or not
      console.log(projectsMetaPath, branch);
      const checkInit = await checkInitialize(fs, projectsMetaPath);
      console.log(checkInit);
      if (!checkInit) {
        const projectInitialized = initProject(fs, projectsMetaPath, branch);
        console.log(projectInitialized);
        if (projectInitialized) {
          console.log(repoName, auth.token.sha1);
          const created = createRepo(repoName, auth.token.sha1);
          console.log(created);
        }
      // } else {
      //   commitChanges(pro);
      }
    } catch (err) {
      logger.debug('SyncToGitea.js', `Error on Sync create/update : ${err}`);
      notifyStatus('failure', `Sync failed : ${err}`);
      await addNotification('Sync', err?.message || err, 'failure');
    } finally {
      setSyncProgress({
        syncStarted: false,
        totalFiles: 0,
        completedFiles: 0,
      });
    }
  });
}
