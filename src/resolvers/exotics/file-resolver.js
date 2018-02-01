/* @flow */

import path from 'path';

import invariant from 'invariant';
import uuid from 'uuid';

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import type {RegistryNames} from '../../registries/index.js';
import {MessageError} from '../../errors.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';
import * as fs from '../../util/fs.js';

export const FILE_PROTOCOL_PREFIX = 'file:';

const buildParentPath = (acc: string[], request: PackageRequest) : string[] => {
  if(!request.parentRequest){
    return acc;
  } else {
    const {parentRequest, parentNames} = request;
    const n = parentNames.length > 0 ?  parentNames[parentNames.length -1] : undefined;
    if(!n){
      throw new Error('parentRequest is present, but parentNames is empty?');
    }
    const p = parentRequest.pattern.replace(`${n}@`, '');
    acc.push(p);
    return buildParentPath(acc, parentRequest);
  }
}

const resolvePath = (lockfileFolder:string, request: PackageRequest, loc:string) : string => {
  const parents = buildParentPath([], request);
  const args = [lockfileFolder].concat(parents).concat([loc]);
  const out = path.resolve.apply(path, args);
  return out;
}

export default class FileResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);
    this.loc = util.removePrefix(fragment, FILE_PROTOCOL_PREFIX);
  }

  loc: string;

  static protocol = 'file';
  static prefixMatcher = /^\.{1,2}\//;

  static isVersion(pattern: string): boolean {
    return super.isVersion.call(this, pattern) || this.prefixMatcher.test(pattern) || path.isAbsolute(pattern);
  }

  async resolve(): Promise<Manifest> {
    let loc = this.loc;
    if (!path.isAbsolute(loc)) {
      /**
       * >> Dont resolve just against the lock file dir.
       * loc = path.resolve(this.config.lockfileFolder, loc);
       */
      loc  = resolvePath(this.config.lockfileFolder, this.request, loc);
    }

    if (this.config.linkFileDependencies) {
      const registry: RegistryNames = 'npm';
      const manifest: Manifest = {_uid: '', name: '', version: '0.0.0', _registry: registry};
      manifest._remote = {
        type: 'link',
        registry,
        hash: null,
        reference: loc,
      };
      manifest._uid = manifest.version;
      return manifest;
    }
    if (!await fs.exists(loc)) {
      throw new MessageError(this.reporter.lang('doesntExist', loc, this.pattern.split('@')[0]));
    }

    const manifest: Manifest = await (async () => {
      try {
        return await this.config.readManifest(loc, this.registry);
      } catch (e) {
        if (e.code === 'ENOENT') {
          return {
            // This is just the default, it can be overridden with key of dependencies
            name: path.dirname(loc),
            version: '0.0.0',
            _uid: '0.0.0',
            _registry: 'npm',
          };
        }

        throw e;
      }
    })();
    const registry = manifest._registry;
    invariant(registry, 'expected registry');

    manifest._remote = {
      type: 'copy',
      registry,
      hash: `${uuid.v4()}-${new Date().getTime()}`,
      reference: loc,
    };

    manifest._uid = manifest.version;

    return manifest;
  }
}
