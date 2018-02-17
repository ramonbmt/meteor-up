#!/bin/bash

sudo mkdir -p /opt/mongodb
sudo chown ${USER} /opt/mongodb -R

apt install mongo-clients