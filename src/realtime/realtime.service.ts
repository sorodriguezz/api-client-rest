import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";

export type WsEvent =
  | { type: "node.created"; workspaceId: string; nodeId: string }
  | { type: "node.updated"; workspaceId: string; nodeId: string }
  | { type: "node.deleted"; workspaceId: string; nodeId: string }
  | { type: "request.updated"; workspaceId: string; nodeId: string }
  | { type: "tree.cloned"; workspaceId: string; rootId: string; count: number }
  | { type: "workspace.updated"; workspaceId: string; name: string }
  | { type: "workspace.deleted"; workspaceId: string };

@Injectable()
export class RealtimeService {
  private subjects = new Map<string, Subject<WsEvent>>();

  private get(workspaceId: string) {
    let s = this.subjects.get(workspaceId);
    if (!s) {
      s = new Subject<WsEvent>();
      this.subjects.set(workspaceId, s);
    }
    return s;
  }

  publish(ev: WsEvent) {
    this.get(ev.workspaceId).next(ev);
  }

  stream(workspaceId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const sub = this.get(workspaceId).subscribe((ev) =>
        subscriber.next({ data: ev } as MessageEvent)
      );
      subscriber.next({ data: { type: "ping" } } as MessageEvent);
      return () => sub.unsubscribe();
    });
  }
}
