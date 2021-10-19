/* eslint-disable no-alert */
import moment from 'moment';
import { v5 as uuidv5 } from 'uuid';
import { environment } from '../../../environment';
import * as logger from '../../logger';
import { validate } from '../../util/validate';

const md5 = require('md5');

const importBurrito = async (filePath, currentUser) => {
  logger.debug('importBurrito.js', 'Inside importBurrito');
  const fs = window.require('fs');
  const fse = window.require('fs-extra');
  const path = require('path');
  const status = [];
  const newpath = localStorage.getItem('userPath');
  const projectDir = path.join(newpath, 'autographa', 'users', currentUser, 'projects');
  fs.mkdirSync(projectDir, { recursive: true });
  // Importing the project
  if (fs.existsSync(path.join(filePath, 'metadata.json'))) {
    logger.debug('importBurrito.js', 'Project has Burrito file metadata.json.');
    const sb = fs.readFileSync(path.join(filePath, 'metadata.json'));
    const metadata = JSON.parse(sb);
    const success = validate('metadata', path.join(filePath, 'metadata.json'), sb);
    if (success) {
      logger.debug('importBurrito.js', 'Burrito file validated successfully');
      let projectName = metadata.identification?.name?.en;
      let existingProject;
      let id;
      const folderList = fs.readdirSync(projectDir);
      logger.debug('importBurrito.js', 'Checking for AG primary key');
      if (metadata.identification.primary.ag !== undefined) {
        Object.entries(metadata.identification?.primary?.ag).forEach(([key]) => {
          logger.debug('importBurrito.js', 'Fetching the key from burrito.');
          id = key;
        });
      } else if (metadata.identification.upstream.ag !== undefined) {
        Object.entries(metadata.identification.primary).forEach(([key]) => {
          logger.debug('importBurrito.js', 'Swapping data between primary and upstream');
          const identity = metadata.identification.primary[key];
          metadata.identification.upstream[key] = [identity];
          delete metadata.identification.primary[key];
          delete metadata.idAuthorities;
        });
        metadata.idAuthorities = {
          ag: {
            id: 'http://www.autographa.org',
            name: {
              en: 'Autographa application',
            },
          },
        };
        const list = metadata.identification?.upstream?.ag;
        logger.debug('importBurrito.js', 'Fetching the latest key from list.');
        // eslint-disable-next-line max-len
        const latest = list.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b));
        Object.entries(latest).forEach(([key]) => {
          logger.debug('importBurrito.js', 'Fetching the key from burrito.');
          id = key;
        });
        if (list.length > 1) {
          (metadata.identification.upstream.ag).forEach((e, i) => {
            if (e === latest) {
              (metadata.identification?.upstream?.ag).splice(i, 1);
            }
          });
        } else {
          delete metadata.identification?.upstream?.ag;
        }
        metadata.identification.primary.ag = latest;
      }
      if (id && projectName) {
        await folderList.forEach((folder) => {
          if (folder === `${projectName}_${id}`) {
            logger.debug('importBurrito.js', 'Project already exists.');
            existingProject = true;
          }
        });
      } else {
        if (!id) {
          Object.entries(metadata.identification.primary).forEach(([key]) => {
            logger.debug('importBurrito.js', 'Swapping data between primary and upstream');
            if (key !== 'ag') {
              const identity = metadata.identification.primary[key];
              metadata.identification.upstream[key] = [identity];
              delete metadata.identification.primary[key];
            }
          });
          logger.debug('importBurrito.js', 'Creating a new key.');
          const key = currentUser + metadata.identification.name.en + moment().format();
          id = uuidv5(key, environment.uuidToken);
          metadata.identification.primary.ag = {
            [id]: {
            revision: '0',
            timestamp: moment().format(),
            },
          };
        }
        if (!projectName) {
          logger.debug('importBurrito.js', 'Folder name as Project Name');
          projectName = path.basename(filePath);
        }
      }
      if (existingProject === true) {
        logger.debug('importBurrito.js', 'Project already exists.');
        alert('Existing project');
        projectName = `${projectName}_copy`;
      } else {
        logger.debug('importBurrito.js', 'This is a New Project.');
      }

      fs.mkdirSync(path.join(projectDir, `${projectName}_${id}`, 'ingredients'), { recursive: true });
      logger.debug('importBurrito.js', 'Creating a directory if not existed.');
      await fse.copy(filePath, path.join(projectDir, `${projectName}_${id}`))
      .then(() => {
        Object.entries(metadata.ingredients).forEach(([key, value]) => {
          logger.debug('importBurrito.js', 'Fetching keys from ingredients.');
          const content = fs.readFileSync(path.join(projectDir, `${projectName}_${id}`, key), 'utf8');
          const checksum = md5(content);
          if (checksum !== value.checksum.md5) {
            logger.debug('importBurrito.js', 'Updating the checksum.');
          }
          const stats = fs.statSync(path.join(filePath, key));
          if (stats.size !== value.size) {
            logger.debug('importBurrito.js', 'Updating the size.');
          }
          metadata.ingredients[key].checksum.md5 = checksum;
          metadata.ingredients[key].size = stats.size;
        });
      })
      .catch((err) => logger.debug('importBurrito.js', `${err}`));

      metadata.meta.generator.userName = currentUser;
      if (!fs.existsSync(path.join(filePath, 'ingredients', 'ag-settings.json'))) {
        logger.debug('importBurrito.js', 'Creating ag-settings.json file');
        const settings = {
          version: environment.AG_SETTING_VERSION,
          project: {
            textTranslation: {
              scriptDirection: 'LTR',
              starred: false,
              description: '',
              lastSeen: moment().format(),
              refResources: [],
              bookMarks: [],
            },
          },
        };
        logger.debug('importBurrito.js', 'Creating the ag-settings.json file.');
        await fs.writeFileSync(path.join(projectDir, `${projectName}_${id}`, 'ingredients', 'ag-settings.json'), JSON.stringify(settings));
        const stat = fs.statSync(path.join(projectDir, `${projectName}_${id}`, 'ingredients', 'ag-settings.json'));
        metadata.ingredients[path.join('ingredients', 'ag-settings.json')] = {
          checksum: {
            md5: md5(settings),
          },
          mimeType: 'application/json',
          size: stat.size,
          role: 'x-autographa',
        };
      }
      await fs.writeFileSync(path.join(projectDir, `${projectName}_${id}`, 'metadata.json'), JSON.stringify(metadata));
      logger.debug('importBurrito.js', 'Creating the metadata.json Burrito file.');
      status.push({ type: 'success', value: 'Project Imported Successfully' });
    } else {
      logger.debug('importBurrito.js', 'Invalid burrito file (metadata.json).');
      status.push({ type: 'error', value: 'Invalid burrito file (metadata.json).' });
    }
  } else {
    logger.debug('importBurrito.js', 'Unable to find burrito file (metadata.json).');
    status.push({ type: 'error', value: 'Unable to find burrito file (metadata.json).' });
  }
  return status;
};
export default importBurrito;
