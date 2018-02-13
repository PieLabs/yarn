import FileResolver from './resolvers/exotics/file-resolver';
import Config from './config';
import * as path from 'path';
import debug from 'debug';
import * as fs from './util/fs.js';

const log = debug('yarn:pattern-builder');

export async function buildPattern(
  name:string,
  range:string,
  patternDir:string,
  config: Config
) : Promise<string> {
  log('[buildPattern] name:', name, 'range: ', range, 'patternDir: ', patternDir);

  if(FileResolver.isVersion(range)){
      if(path.isAbsolute(range)){
        // we don't alter absolute paths
        return `${name}@${range}`;
      } else {
        const stat = await fs.stat(patternDir);
        const dirPath = stat.isFile() ? path.dirname(patternDir) : patternDir;
        //we need to adjust the path to make it relative to the lockfileFolder
        const fullPath = path.resolve(dirPath, range);
        const relative = path.relative(config.lockfileFolder, fullPath);
        log('[buildPattern] relative:', relative);
        return `${name}@file:./${relative}`;
      }
  } else {
    return `${name}@${range}`;
  }
}
