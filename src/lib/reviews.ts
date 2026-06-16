/** Отзыв о курсе (публичное представление — без user_id). */
export interface Review {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

/** Агрегат отзывов курса для страницы. */
export interface CourseReviews {
  list: Review[];
  count: number;
  /** Средняя оценка (0 если отзывов нет), округлена до 0.1. */
  average: number;
}
