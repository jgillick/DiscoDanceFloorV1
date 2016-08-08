# Disco Dance Floor Controller

This is an app to control (or emulate) the disco floor. The interface is built in JavaScript/Typescript with Angular
on [Electron](http://electron.atom.io/).

## Installation and Running

### Prerequisites

 * [node 5.12](https://nodejs.org/en/)
 * [gulp](http://gulpjs.com/)


### Install

Start by installing Node 5.12 via [nvm](https://github.com/creationix/nvm).

```sh
nvm install 5.12
```

This will install and run the app in development mode:

```sh
npm install

gulp
```

## Create the App

To create the production app:

```sh
gulp dist-osx    # Mac
gulp dist-linux  # Linux
gulp dist-win    # Windows
```
