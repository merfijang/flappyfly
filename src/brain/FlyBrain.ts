import type { BrainManifest, BrainResult, FlappyState, Mode } from '../types';
export class FlyBrain {
  private worker = new Worker(new URL('./flyBrain.worker.ts', import.meta.url), { type: 'module' });
  private readyResolve?: () => void; private pending = false; private training = false;
  onResult?: (result: BrainResult) => void; onProgress?: (value:number,label:string) => void; onTrainingProgress?: (done:number,total:number,loss:number) => void; onTrainingDone?: (model:unknown,samples:number,loss:number) => void; onError?: (message:string) => void; activity?: Uint8Array;
  constructor() {
    this.worker.onmessage = (event: MessageEvent) => {
      const m=event.data;
      if(m.type==='PROGRESS') this.onProgress?.(m.value,m.label);
      if(m.type==='READY'){ if(m.activityBuffer) this.activity=new Uint8Array(m.activityBuffer); this.readyResolve?.(); }
      if(m.type==='BRAIN_RESULT'){this.pending=false; this.onResult?.(m.result);}
      if(m.type==='TRAINING_PROGRESS')this.onTrainingProgress?.(m.done,m.total,m.loss);
      if(m.type==='TRAINING_DONE'){this.training=false;this.pending=false;this.onTrainingDone?.(m.model,m.samples,m.loss);}
      if(m.type==='ERROR'){this.training=false;this.pending=false;this.onError?.(m.message);}
    };
  }
  init(manifest: BrainManifest, savedModel?: unknown) { return new Promise<void>((resolve,reject)=>{this.readyResolve=resolve; this.worker.onerror=(e)=>reject(new Error(e.message)); this.worker.postMessage({type:'INIT',manifest,shared:crossOriginIsolated,savedModel});}); }
  step(state: FlappyState, mode: Mode, elapsed: number) { if(this.pending||this.training)return; this.pending=true; this.worker.postMessage({type:'STEP',state,mode,elapsed}); }
  fastTrain(iterations=1200){if(this.training)return;this.training=true;this.worker.postMessage({type:'FAST_TRAIN',iterations});}
  importModel(model:unknown){this.worker.postMessage({type:'IMPORT_MODEL',model});}
  reset(seed:number){this.pending=false;this.worker.postMessage({type:'RESET',seed});}
  dispose(){this.worker.terminate();}
}
