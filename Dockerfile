FROM node:10-alpine AS build

RUN apk add --update git python

WORKDIR /src
RUN chown node:node /src
USER node

ADD package*.json /src/

RUN npm ci

ADD bower.json /src
ADD .bowerrc /src
RUN ./node_modules/.bin/bower install

ADD gulpfile.js /src
ADD src /src
RUN npm run build

FROM nginx:alpine

WORKDIR /usr/share/nginx/html

COPY --from=build /src/public /usr/share/nginx/html
