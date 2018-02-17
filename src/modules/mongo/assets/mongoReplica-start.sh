#!/bin/bash

# sudo apt-get update
# sudo apt-get -y install mongodb-clients
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6
echo "deb [ arch=amd64,arm64 ] http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.4.list

sudo apt-get update

sudo apt-get install -y mongodb-org=3.4.1 mongodb-org-shell=3.4.1 mongodb-org-mongos=3.4.1 mongodb-org-tools=3.4.1


mongo --eval 'rs.initiate({_id: "replicaset", members: [{_id: 0, host: "127.0.0.1:27017"}]})'


