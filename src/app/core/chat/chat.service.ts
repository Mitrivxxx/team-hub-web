import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AddConversationMemberRequest,
  Conversation,
  ConversationMember,
  ConversationPage,
  ConversationPin,
  ConversationSettings,
  CreateConversationRequest,
  CreateMessageRequest,
  Message,
  MessageAttachment,
  MessagePage,
  MessageReaction,
  UpdateConversationSettingsRequest,
} from './chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.chatApiUrl;

  private orgBase(organizationId: string): string {
    return `${this.baseUrl}/organizations/${organizationId}/conversations`;
  }

  listConversations(
    organizationId: string,
    page = 1,
    pageSize = 50,
  ): Observable<ConversationPage> {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    return this.http.get<ConversationPage>(this.orgBase(organizationId), { params });
  }

  createConversation(
    organizationId: string,
    body: CreateConversationRequest,
  ): Observable<Conversation> {
    return this.http.post<Conversation>(this.orgBase(organizationId), body);
  }

  getConversation(organizationId: string, conversationId: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.orgBase(organizationId)}/${conversationId}`);
  }

  updateConversation(
    organizationId: string,
    conversationId: string,
    body: { name: string },
  ): Observable<Conversation> {
    return this.http.patch<Conversation>(`${this.orgBase(organizationId)}/${conversationId}`, body);
  }

  deleteConversation(organizationId: string, conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.orgBase(organizationId)}/${conversationId}`);
  }

  listMembers(organizationId: string, conversationId: string): Observable<ConversationMember[]> {
    return this.http.get<ConversationMember[]>(
      `${this.orgBase(organizationId)}/${conversationId}/members`,
    );
  }

  addMember(
    organizationId: string,
    conversationId: string,
    body: AddConversationMemberRequest,
  ): Observable<ConversationMember> {
    return this.http.post<ConversationMember>(
      `${this.orgBase(organizationId)}/${conversationId}/members`,
      body,
    );
  }

  leaveConversation(organizationId: string, conversationId: string): Observable<void> {
    return this.http.post<void>(`${this.orgBase(organizationId)}/${conversationId}/leave`, {});
  }

  listMessages(
    organizationId: string,
    conversationId: string,
    options?: { before?: string; after?: string; pageSize?: number },
  ): Observable<MessagePage> {
    let params = new HttpParams().set('pageSize', String(options?.pageSize ?? 50));
    if (options?.before) {
      params = params.set('before', options.before);
    }
    if (options?.after) {
      params = params.set('after', options.after);
    }
    return this.http.get<MessagePage>(
      `${this.orgBase(organizationId)}/${conversationId}/messages`,
      { params },
    );
  }

  sendMessage(
    organizationId: string,
    conversationId: string,
    body: CreateMessageRequest,
  ): Observable<Message> {
    return this.http.post<Message>(
      `${this.orgBase(organizationId)}/${conversationId}/messages`,
      body,
    );
  }

  setReaction(
    organizationId: string,
    conversationId: string,
    messageId: string,
    reaction: string,
  ): Observable<MessageReaction> {
    return this.http.put<MessageReaction>(
      `${this.orgBase(organizationId)}/${conversationId}/messages/${messageId}/reactions`,
      { reaction },
    );
  }

  deleteReaction(
    organizationId: string,
    conversationId: string,
    messageId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.orgBase(organizationId)}/${conversationId}/messages/${messageId}/reactions`,
    );
  }

  markRead(
    organizationId: string,
    conversationId: string,
    messageId: string,
  ): Observable<void> {
    return this.http.post<void>(
      `${this.orgBase(organizationId)}/${conversationId}/messages/${messageId}/read`,
      {},
    );
  }

  getPin(organizationId: string, conversationId: string): Observable<ConversationPin> {
    return this.http.get<ConversationPin>(`${this.orgBase(organizationId)}/${conversationId}/pin`);
  }

  setPin(
    organizationId: string,
    conversationId: string,
    messageId: string,
  ): Observable<ConversationPin> {
    return this.http.put<ConversationPin>(
      `${this.orgBase(organizationId)}/${conversationId}/pin`,
      { messageId },
    );
  }

  deletePin(organizationId: string, conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.orgBase(organizationId)}/${conversationId}/pin`);
  }

  getSettings(
    organizationId: string,
    conversationId: string,
  ): Observable<ConversationSettings> {
    return this.http.get<ConversationSettings>(
      `${this.orgBase(organizationId)}/${conversationId}/settings`,
    );
  }

  updateSettings(
    organizationId: string,
    conversationId: string,
    body: UpdateConversationSettingsRequest,
  ): Observable<ConversationSettings> {
    return this.http.patch<ConversationSettings>(
      `${this.orgBase(organizationId)}/${conversationId}/settings`,
      body,
    );
  }

  uploadAttachment(
    organizationId: string,
    conversationId: string,
    messageId: string,
    file: File,
  ): Observable<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<MessageAttachment>(
      `${this.orgBase(organizationId)}/${conversationId}/messages/${messageId}/attachments`,
      formData,
    );
  }
}
