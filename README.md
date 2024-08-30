# pert-chart
PERT chart is a browser-based PERT chart maker and viewer.

## Features
- Deadlines and time constraints
- Real-time milestone advancement
- Resource management
- Budget and capacity conflicts visualization
- Statistics
- Requirement changes reporting
- Project import / export

## Using with Docker
To use with Docker simply build and run the image:
```sh
# Build the image
sudo docker build -t pert-chart .

# Run
sudo docker run -d pert-chart
```

By default the app is hosted on port 80 of the container - to bind it to a port on the host, e.g 8080, add the `-p 8080:80` option to the `docker run` command.

## Requirements
- `npm` (from Node) for installation.
- Chrome 49 or newer, Opera 36 or newer (support for Firefox, Safari, IE and Edge is underway)


## Installation
Installing PERT chart is as easy as running:
```sh
npm install
npm run build
```

If you plan on running it with Node's `http-server` (see next section), make sure it has been installed first:
```sh
sudo npm install --global http-server
```

## Running
Due to using `localStorage` as its storage back-end, which does not play well with the `file://` protocol, PERT chart
must be run hosted to work properly. It can either be served with any preexisting web-server, or for simplicity - with
Node's `http-server`:

```sh
# inside the root of the project directory
http-server public

# or alternatively
npm start
```
