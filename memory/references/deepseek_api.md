# DeepSeek API 参数速查

## 模型列表
- deepseek-v4-flash: 快速模型，64K上下文
- deepseek-v4-pro: 强力模型，64K上下文，支持thinking
- deepseek-v4-flash[1m]: Flash + 1M上下文
- deepseek-v4-pro[1m]: Pro + 1M上下文

## Thinking 模式
- 开关: {\"thinking\": {\"type\": \"enabled\"}}
- 强度: {\"reasoning_effort\": \"high\"} 或 \"max\"

## 调用示例
```python
body = {
  \"model\": \"deepseek-v4-pro\",
  \"messages\": [...],
  \"thinking\": {\"type\": \"enabled\"},
  \"reasoning_effort\": \"high\"
}
```