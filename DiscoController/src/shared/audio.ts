

/**
 * Initializes the chrome browser audio service and provides 
 * a simple API to the data. 
 */
class Audio {
  
  analyser: any;
  
  private _audioCtx: any;
  private _source: any;
  
  constructor() {
    this._audioCtx = new AudioContext();
    this.analyser = this._audioCtx.createAnalyser();
  }
  
  /**
   * Connect to the audio sources.
   * 
   * @return {Promise}
   */
  connect(fftSize:number=128): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      navigator.webkitGetUserMedia(
        {
          audio: true, 
          video: false
        },
        (stream) => {
          this._source = this._audioCtx.createMediaStreamSource(stream);
          this._source.connect(this.analyser);
          this.analyser.fftSize = fftSize;
          resolve();
        },
        function(e){
          console.error('Could not connect to audio source: '+ e.message);
          reject({ error: e });
        }
      );
    });
  }
  
  /**
   * Close the audio connection
   * 
   * @return {Promise}
   */
  disconnect(): Promise<void> { 
    return new Promise<void>((resolve, reject) => {
      try {
        if (this._audioCtx && this._audioCtx.state == 'running') {
          if (this._audioCtx.close) {
            this._audioCtx.close().then(resolve, reject);
          } 
          else if (this._audioCtx.suspend) {
            this._audioCtx.suspend().then(resolve, reject)
          }
          else {
            resolve();
          }
        }
      } catch(e) {
        console.error(e.message);
        reject(e);
      }
    });
  }
}

export let audio = new Audio();
audio.connect();
