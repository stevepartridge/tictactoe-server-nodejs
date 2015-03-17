FROM node:0.10.36-onbuild
MAINTAINER Steve Partridge

# make sure apt is up to date
RUN apt-get update

# install nodejs and npm
RUN apt-get install -y git git-core

# install forever
RUN npm install -g forever

RUN mkdir /app

ADD install.sh /app/

RUN chmod +x /app/install.sh

# run the install script that pulls the master of the git repo
CMD ./app/install.sh

EXPOSE 6975

# start the app
CMD forever -c 'node --harmony' /usr/src/app/server.js

# clean up apt and such
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*