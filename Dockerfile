FROM node:10-alpine AS build

RUN apk add --update git python

WORKDIR /src
RUN chown node:node /src
USER node

ADD package*.json /src/

RUN npm ci

ADD gulpfile.js /src
ADD src /src
RUN npm run build

FROM nginx:alpine

WORKDIR /usr/share/nginx/html

COPY --from=build /src/public /usr/share/nginx/html
