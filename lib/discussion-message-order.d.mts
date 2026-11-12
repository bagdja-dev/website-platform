export interface ChronologicalMessage {
  id: string;
  createdAt: string;
}

export function sortDiscussionMessages<T extends ChronologicalMessage>(
  messages: T[],
): T[];
