import { Topic, TopicRepository } from "../../domain/repositories/topic.repository";

export class ApiTopicRepository implements TopicRepository {
  async getMyTopics(): Promise<Topic[]> {
    try {
      // Example endpoint based on KLTN system requirements
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/student/topics`, { 
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          // Include Authorization header if needed using a token
        }
      });
      if (!res.ok) {
        throw new Error("Failed to fetch topics from API");
      }
      return res.json();
    } catch (error) {
      console.error("ApiTopicRepository error:", error);
      throw error;
    }
  }
}
