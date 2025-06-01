import React, { useState, useEffect } from "react";
import axios from "axios";
import "./CommentsPage.css"; // 그대로 사용

const API_COMMENTS_URL = "http://34.47.73.162:5001/api/comments";

function CommentSection({ inquiryId }) {
  const [comments, setComments] = useState([]);
  const [commentData, setCommentData] = useState({ author: "", content: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_COMMENTS_URL}/${inquiryId}`);
      setComments(response.data);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCommentData({ ...commentData, [name]: value });
  };

  const saveComment = async () => {
    if (!commentData.author || !commentData.content) {
      alert("작성자와 내용을 모두 입력해주세요.");
      return;
    }
    try {
      const payload = { ...commentData, inquiry_id: inquiryId };
      if (commentData.id) {
        await axios.put(`${API_COMMENTS_URL}/${commentData.id}`, payload);
        alert("댓글이 수정되었습니다.");
      } else {
        await axios.post(API_COMMENTS_URL, payload);
        alert("댓글이 추가되었습니다.");
      }
      fetchComments();
      setCommentData({ author: "", content: "" });
    } catch (error) {
      console.error("Failed to save comment:", error);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await axios.delete(`${API_COMMENTS_URL}/${commentId}`);
      alert("댓글이 삭제되었습니다.");
      fetchComments();
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  return (
    <div className="comments-container">
      <h4>댓글</h4>
      {loading ? (
        <p>댓글을 불러오는 중입니다...</p>
      ) : (
        <>
          <ul className="comments-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-item">
                <p>
                  <strong>{comment.author}:</strong> {comment.content}
                </p>
                <small>{comment.date}</small>
                <div>
                  <button onClick={() => setCommentData(comment)} className="edit-button">
                    수정
                  </button>
                  <button onClick={() => deleteComment(comment.id)} className="delete-button">
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <label>작성자</label>
          <input
            type="text"
            name="author"
            value={commentData.author}
            onChange={handleInputChange}
          />
          <label>내용</label>
          <textarea
            name="content"
            value={commentData.content}
            onChange={handleInputChange}
          ></textarea>
          <button onClick={saveComment} className="save-button" disabled={loading}>
            저장
          </button>
        </>
      )}
    </div>
  );
}

export default CommentSection;
