// src/app/core/services/ws.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export type WsStatus = 'CLOSED' | 'CONNECTING' | 'OPEN';

@Injectable({ providedIn: 'root' })
export class WsService implements OnDestroy {
  private socket?: WebSocket;

  private readonly statusSubject = new BehaviorSubject<WsStatus>('CLOSED');
  readonly status$ = this.statusSubject.asObservable();

  readonly raw$  = new Subject<string>();   // messages bruts
  readonly json$ = new Subject<unknown>();  // messages JSON parsés

  connect(url: string): void {
    this.close();
    this.statusSubject.next('CONNECTING');
    this.socket = new WebSocket(url);

    this.socket.onopen    = () => this.statusSubject.next('OPEN');
    this.socket.onmessage = (e) => this.handleMessage(e);
    this.socket.onerror   = (e) => console.error('WebSocket error:', e);
    this.socket.onclose   = () => this.statusSubject.next('CLOSED');
  }

  send(data: string | object): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket non ouvert, message ignoré:', data);
      return;
    }
    this.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
  }

  close(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000, 'Client closing');
    }
    this.socket = undefined;
    this.statusSubject.next('CLOSED');
  }

  ngOnDestroy(): void {
    this.close();
    this.statusSubject.complete();
    this.raw$.complete();
    this.json$.complete();
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data === 'string') {
      this.raw$.next(event.data);
      this.tryParseJson(event.data);
    } else if (event.data instanceof Blob) {
      event.data.text().then(t => {
        this.raw$.next(t);
        this.tryParseJson(t);
      });
    }
  }

  private tryParseJson(text: string): void {
    try { this.json$.next(JSON.parse(text)); } catch {}
  }
}



----------------------------------integration test----------------------------------

// src/app/features/ws-demo/ws-demo.component.ts
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, filter } from 'rxjs';
import { WsService, WsStatus } from '../../core/services/ws.service';

@Component({
  selector: 'app-ws-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 space-y-3">
      <div>
        <strong>Statut:</strong> {{ status() }}
      </div>

      <div class="space-x-2">
        <button (click)="connect()" [disabled]="status()==='CONNECTING'">
          Connecter
        </button>
        <button (click)="sendInit()" [disabled]="status()!=='OPEN'">
          Envoyer idBatch
        </button>
        <button (click)="sendPing()" [disabled]="status()!=='OPEN'">
          Ping
        </button>
        <button (click)="disconnect()" [disabled]="status()==='CLOSED'">
          Fermer
        </button>
      </div>

      <h4>Derniers messages (RAW):</h4>
      <pre *ngFor="let m of rawLogs">{{ m }}</pre>

      <h4>Derniers messages (JSON):</h4>
      <pre *ngFor="let j of jsonLogs">{{ j | json }}</pre>
    </div>
  `,
  styles: [`
    button { padding: 8px 12px; border-radius: 8px; border: 1px solid #ddd; }
    h4 { margin-top: 12px; }
    pre { background:#f7f7f7; padding:8px; border-radius:8px; }
  `]
})
export class WsDemoComponent implements OnInit, OnDestroy {
  private subs: Subscription[] = [];
  status = signal<WsStatus>('CLOSED');

  rawLogs: string[] = [];
  jsonLogs: unknown[] = [];

  // ⚠️ adapte ces valeurs à ton backend
  private url = 'wss://localhost:8081/ws-transactions';
  private idBatch = '12345';

  constructor(private ws: WsService) {}

  ngOnInit(): void {
    this.subs.push(
      this.ws.status$.subscribe(s => this.status.set(s)),
      this.ws.raw$.subscribe(m => this.rawLogs.unshift(m)),
      this.ws.json$.subscribe(j => this.jsonLogs.unshift(j)),

      // Exemple : si ton serveur envoie des événements JSON {event: 'done', ...}
      this.ws.json$
        .pipe(filter((m: any) => !!m && m.event === 'done'))
        .subscribe(m => console.log('DONE =>', m))
    );
  }

  connect(): void {
    this.ws.connect(this.url);

    // envoyez automatiquement idBatch à l’ouverture si vous préférez
    const sub = this.ws.status$.subscribe(s => {
      if (s === 'OPEN') {
        this.ws.send({ idBatch: this.idBatch });
        sub.unsubscribe();
      }
    });
  }

  sendInit(): void {
    this.ws.send({ idBatch: this.idBatch });
  }

  sendPing(): void {
    this.ws.send({ type: 'PING', at: Date.now() });
  }

  disconnect(): void {
    this.ws.close();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.ws.close();
  }
}
