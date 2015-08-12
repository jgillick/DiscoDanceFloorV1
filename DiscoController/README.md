# Disco Dance Floor Controller

This is an app to control and/or emulate the disco dance floor written in JavaScript with
[NodeJS](http://nodejs.org) and [NWJS](http://nwjs.io/). The app, on it's own, simply communicates
with the floor and uses simple user-written JavaScript programs to control it. You can find
a collection of example programs in the `programs` directory.

## Installation

You'll need to follow these steps to get the app running:

 1. Install [IO.js](https://iojs.org/en/index.html)
 2. Download [NW.js](http://nwjs.io/) and update your `PATH`. (See the 'Installing NW.js' section below for steps)
 3. Install the SASS ruby gem: `sudo gem install sass`
 4. Clone this repo into a directory
 5. Go into that directory and run: `npm install`
 6. Now run `nwjs .` and the app should launch. See the Troubleshooting section if you get errors.

### Install SerialPort

This one takes a special step. Go into the DiscoController directory and do the following:

1. `npm install -g node-pre-gyp`
2. `node-pre-gyp rebuild --runtime=node-webkit --target=0.12.3`
	- Replace `0.12.3` with the version of nwjs you downloaded.

### Installing NW.js

Here's how I installed NW.js on my mac

 1. Download the latest NW.js pacakged from http://nwjs.io/
 2. Extract the file somewhere on your system
 3. Update your `PATH` environment variable to point to the directory with the nwjs executable:

On my mac:
```
echo "export PATH=\$PATH:/Applications/nw/nwjs.app/Contents/MacOS/" >> ~/.bash_profile
```

## Start the App

In a terminal, navigate to the directory where you cloned this repo and enter:

```
nwjs .
```

## Troubleshooting

### SerialPort
If you see errors about not being able to find 'serialport', you might have to rename the serialport build directory.

 * Look at the path that it says it cannot find. Should look something like: `.../node_modules/serialport/build/serialport/v1.6.1/Release/xyz...`
 * Navigate to the Release directory in that path: `cd ./node_modules/serialport/build/serialport/v1.6.1/Release/`
 * Create a symlink from what's there to the directory it is looking for.
    * In my case: `ln -s node-v43-darwin-x64 node-webkit-v43-darwin-x64`

That should fix it.

## How to write a floor program
TBD

## How the controller works
TBD