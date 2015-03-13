## INSTALLATION

### IO.js

https://iojs.org/en/index.html

### NWJS
Download [nw](http://nwjs.io/) and update your `PATH` to the directory with the nwjs executable (on mac, `nwjs.app/Contents/MacOS/nwjs`). 
Mine looks like this in `~/.bash_profile`:

```
export PATH=$PATH:/Applications/nw/nwjs.app/Contents/MacOS/
```

### SASS

```
sudo gem install sass
```

### NPM Modules

```
npm install
```

You might have to rename the `serialport` build directory. Start the app and if you see the error message in the console.

## Star the App

In a terminal, navigate to this directory, then enter:

```
nwjs .
```