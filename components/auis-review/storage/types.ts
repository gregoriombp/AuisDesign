import type {
  ReviewActor,
  ReviewComment,
  ReviewCommentStatus,
  ReviewExportPayload,
  ReviewIdentity,
  ReviewReply,
} from "../types"

export interface ReviewStorageFilter {
  url?: string
  status?: ReviewCommentStatus
}

export interface ReviewArchiveFilter {
  url?: string
  before?: number
  limit?: number
}

export interface ReviewArchivePage {
  comments: ReviewComment[]
  nextCursor?: number
}

export type ReviewTransition =
  | "in_review"
  | "approve"
  | "reject"
  | "resolve_direct"
  | "reopen_from_archive"

export interface ReviewReplyInput {
  authorKind: "agent" | "user"
  authorId: string
  authorName: string
  authorColorToken?: string
  text: string
  images?: string[]
}

export interface ReviewStorage {
  getIdentity(): Promise<ReviewIdentity | null>
  setIdentity(identity: ReviewIdentity): Promise<void>

  listComments(filter?: ReviewStorageFilter): Promise<ReviewComment[]>
  listArchive?(filter?: ReviewArchiveFilter): Promise<ReviewArchivePage>
  getComment(id: string): Promise<ReviewComment | null>
  saveComment(comment: ReviewComment): Promise<void>
  deleteComment(id: string): Promise<void>

  transitionComment?(
    id: string,
    transition: ReviewTransition,
    actor?: ReviewActor
  ): Promise<ReviewComment | null>
  addReply?(commentId: string, reply: ReviewReplyInput): Promise<ReviewReply | null>

  exportAll(): Promise<ReviewExportPayload>
  importMerge(
    payload: ReviewExportPayload
  ): Promise<{ added: number; skipped: number }>

  subscribe?(onChange: () => void): () => void
}
