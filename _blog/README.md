# Writing (blog sources)

각 글은 `_blog/<slug>.md` (마크다운) + `_blog/posts.json` (제목·설명·날짜).

```bash
node _products/blog-gen.mjs      # repo 루트에서
```

만드는 것: `blog/index.html`, `blog/<slug>/index.html`, `blog/blog.css`, `sitemap.xml`, `llms.txt`.

- 마크다운은 좁은 문법만 지원한다(제목, 문단, 목록, 표, 코드블록, 인용, 수평선, 굵게, 코드, 링크). 원시 HTML은 통과시키지 않는다.
- 첫 `# 제목`이 페이지 H1이 된다.
- `## FAQ` 절의 `**질문?**` + 다음 문단은 화면과 FAQPage JSON-LD 양쪽에 같은 문장으로 들어간다. 질문은 반드시 `?`로 끝낼 것.
- 생성기는 러스트 제품 생성기(`_products/gen`)와 별개다. 이 맥에서 러스트 실행 파일이 샌드박스에 막혀(exec 137) 컴파일 결과를 돌릴 수 없어 Node로 만들었다. 제품 생성기를 돌리면 `sitemap.xml`·`llms.txt`가 글 항목 없이 다시 쓰이므로, 그 뒤에 `node _products/blog-gen.mjs`를 한 번 더 실행한다.
