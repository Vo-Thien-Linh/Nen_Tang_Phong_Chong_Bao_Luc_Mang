export const moderationHook = {
  async afterPostCreated(_post) {
    // TODO: enqueue post moderation work when AI/Kafka integration is available.
  },
  async afterPostEdited(_post) {
    // TODO: enqueue edited post moderation work when AI/Kafka integration is available.
  },
};
