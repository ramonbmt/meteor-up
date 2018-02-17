import { getDockerLogs, resolvePath, runTaskList } from '../utils';

import debug from 'debug';
import nodemiral from 'nodemiral';
import sh from 'shelljs';

const log = debug('mup:module:mongo');

export function dump() {
  log('exec => mup mongo dump');
}

export function help() {
  log('exec => mup mongo help');
  console.log('mup mongo', Object.keys(this));
}

export function logs(api) {
  log('exec => mup mongo logs');

  const args = api.getArgs();
  const sessions = api.getSessions(['mongo']);
  args.shift(); // remove mongo from args sent to docker
  return getDockerLogs('mongodb', sessions, args);
}

export function setup(api) {
  log('exec => mup mongo setup');

  if (!api.getConfig().mongo) {
    // could happen when running "mup mongo setup"
    console.log(
      'Not setting up built-in mongodb since there is no mongo config'
    );
    return;
  }

  const mongoSessions = api.getSessions(['mongo']);
  const meteorSessions = api.getSessions(['meteor']);
  const config = api.getConfig().mongo;
  let oplog = !config.oplog ? false : config.oplog;

  if (meteorSessions.length !== 1) {
    console.log(
      'To use mup built-in mongodb setup, you should have only one meteor app server. To have more app servers, use an external mongodb setup'
    );
    return;
  } else if (mongoSessions[0]._host !== meteorSessions[0]._host) {
    console.log(
      'To use mup built-in mongodb setup, you should have both meteor app and mongodb on the same server'
    );
    return;
  }

  const list = nodemiral.taskList('Setup Mongo');

  list.executeScript('Setup Environment', {
    script: resolvePath(__dirname, 'assets/mongo-setup.sh')
  });

  if (oplog) {
    list.copy('Copying mongodb.conf', {
      src: resolvePath(__dirname, 'assets/mongodbReplica.conf'),
      dest: '/opt/mongodb/mongodb.conf'
    });
  } else {
    list.copy('Copying mongodb.conf', {
      src: resolvePath(__dirname, 'assets/mongodb.conf'),
      dest: '/opt/mongodb/mongodb.conf'
    });
  }

  const sessions = api.getSessions(['mongo']);

  return runTaskList(list, sessions, { verbose: api.getVerbose() });
}

export function realStart(api){
  log('exec => mup mongo start');

  const mongoSessions = api.getSessions(['mongo']);
  const meteorSessions = api.getSessions(['meteor']);
  const config = api.getConfig().mongo;
  let ipwhitelist = !config.ipwhitelist ? '' : config.ipwhitelist;
  let oplog = !config.oplog ? false : config.oplog;

  if (
    meteorSessions.length !== 1 ||
    mongoSessions[0]._host !== meteorSessions[0]._host
  ) {
    log('Skipping mongodb start. Incompatible config');
    return;
  }
  const list = nodemiral.taskList('Start Mongo');
  list.executeScript('Start Mongo', {
    script: resolvePath(__dirname, 'assets/mongo-start.sh'),
    vars: {
      mongoVersion: config.version || '3.4.1',
      ipwhitelist: ipwhitelist
    }
  });
  if (oplog) {
    list.executeScript('Start Replica', {
      script: resolvePath(__dirname, 'assets/mongoReplica-start.sh'),
      vars: {}
    });
  }

  const sessions = api.getSessions(['mongo']);
  return runTaskList(list, sessions, { verbose: api.getVerbose() });
}

export function start(api) {
  log('exec => mup mongo (dummy) start');
  
  const config = api.getConfig().mongo;

  if(config.ipwhitelist){
    return realStart(api).then(() => whitelist(api));
  }else{
    return realStart(api)
  }
}

export function stop(api) {
  log('exec => mup mongo stop');
  const list = nodemiral.taskList('Stop Mongo');

  list.executeScript('stop mongo', {
    script: resolvePath(__dirname, 'assets/mongo-stop.sh')
  });

  const sessions = api.getSessions(['mongo']);
  return runTaskList(list, sessions, { verbose: api.getVerbose() });
}

export function whitelist(api){
  log('exec => mup mongo whitelist');
  const config = api.getConfig().mongo;
  const configMeteor = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }
  let ipwhitelist = !config.ipwhitelist ? '' : config.ipwhitelist;
  let localServers = [];
  if(!configMeteor.ssl){
    localServers.push(configMeteor.name);
  }else if(configMeteor.ssl.autogenerate){
    localServers.push(configMeteor.name+"-nginx-letsencrypt");
    localServers.push(configMeteor.name+"-nginx-proxy");
  }else{
    localServers.push(configMeteor.name+"-frontend");
  }

  const list = nodemiral.taskList('Whitelist Mongo');

  list.executeScript('Whitelist Mongo', {
    script: resolvePath(__dirname, 'assets/iptables.sh'),
    vars: {
      ips: config.ipwhitelist,
      name: configMeteor.name,
      localServers: localServers
    }
  });

  const sessions = api.getSessions(['mongo']);
  return runTaskList(list, sessions, { verbose: api.getVerbose() });
}

export function backup(api) {
  log('exec => mup mongo whitelist');
  const config = api.getConfig().mongo;
  const configMeteor = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }
  const list = nodemiral.taskList('Backup Mongo');
  list.executeScript('Backup Mongo', {
    script: resolvePath(__dirname, 'assets/backup.sh'),
    vars: {
      name: configMeteor.name
    }
  });
  

  const sessions = api.getSessions(['mongo']);
  let result = runTaskList(list, sessions, { verbose: api.getVerbose() });
  sh.exec('scp -r root@162.243.187.18:dump dump');
  return result;
}
