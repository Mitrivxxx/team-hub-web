export type ConversationType = 'DIRECT' | 'GROUP' | string;
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | string;
export type MessageType = 'TEXT' | 'SYSTEM' | string;

export interface Conversation {
  id: string;
  organizationId: string;
  type: ConversationType;
  name: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  myRole: MemberRole;
  memberCount: number;
}

export interface ConversationPage {
  items: Conversation[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CreateConversationRequest {
  type: ConversationType;
  name?: string | null;
  memberUserIds: string[];
}

export interface ConversationMember {
  userId: string;
  role: MemberRole;
  joinedAt: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
}

export interface AddConversationMemberRequest {
  userId: string;
  role: MemberRole;
}

export interface MessageMention {
  userId: string;
}

export interface MessageReaction {
  userId: string;
  reaction: string;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  url: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  replyToMessageId: string | null;
  content: string | null;
  messageType: MessageType;
  createdAt: string;
  updatedAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  mentions: MessageMention[];
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
}

export interface MessagePage {
  items: Message[];
  pageSize: number;
}

export interface CreateMessageRequest {
  content?: string | null;
  messageType: MessageType;
  replyToMessageId?: string | null;
  mentionUserIds?: string[];
}

export interface ConversationPin {
  messageId: string;
  createdAt: string;
}

export interface ConversationSettings {
  notificationsEnabled: boolean;
  mutedUntil: string | null;
  updatedAt: string;
}

export interface UpdateConversationSettingsRequest {
  notificationsEnabled?: boolean;
  mutedUntil?: string | null;
}
