
/**
  Provides helper functions/properties to the web audio API.
  The init method must be called in the browser context
*/

var audioCtx,
    analyser,
    source;

module.exports.context = null;
module.exports.analyser = null;
module.exports.source = null;

/**
  Init the audio API
*/
module.exports.init = function(navigator){
  audioCtx = new window.AudioContext();
  analyser = audioCtx.createAnalyser();

  // Connect to audio source
  navigator.webkitGetUserMedia(
    {audio: true},
    function(stream){
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 128;

      module.exports.context = audioCtx;
      module.exports.analyser = analyser;
      module.exports.source = source;
    },
    function(e){
      console.log('Could not connect to audio source: '+ e.message);
    }
  );
};

/**
  Close the Audio API
*/
module.exports.close = function() {
  return new Promise(function(resolve) {
    try {
      if (audioCtx && audioCtx.state == 'running') {
        if (audioCtx.close) audioCtx.close().then(resolve);
        else if (audioCtx.suspend) audioCtx.suspend().then(resolve);
      }
    } catch(e) {
      console.error(e.message);
      resolve();
    }
  }.bind(this));
};


