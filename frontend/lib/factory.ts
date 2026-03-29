import { TopicRepository } from "./domain/repositories/topic.repository";
import { MockTopicRepository } from "./infrastructure/mock/topic.repository.mock";
import { ApiTopicRepository } from "./infrastructure/api/topic.repository.api";

export class RepositoryFactory {
  /**
   * Returns the appropriate TopicRepository implementation based on the environment configuration.
   */
  static getTopicRepository(): TopicRepository {
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";
    if (useMock) {
      return new MockTopicRepository();
    }
    return new ApiTopicRepository();
  }
}
