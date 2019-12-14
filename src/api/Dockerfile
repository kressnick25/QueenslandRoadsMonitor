FROM node:10
# create app directory
WORKDIR /usr/src/app
# use same package manager used in development
RUN npm install -g yarn
# copy source code from server folder to app
COPY . .
# install node_modules
RUN yarn
# open port 3000 in container
EXPOSE 3000
# start node instance
CMD ["yarn", "start"]

