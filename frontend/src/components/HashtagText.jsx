import { splitHashtagText } from '../../../shared/hashtag.js';

export default function HashtagText({ text, className = '' }) {
  const parts = splitHashtagText(text);
  return (
    <span className={className}>
      {parts.map((part, index) => part.type === 'hashtag' ? (
        <a
          key={`${part.tag}-${index}`}
          href={`#hashtag/${encodeURIComponent(part.tag)}`}
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {part.value}
        </a>
      ) : <span key={`text-${index}`}>{part.value}</span>)}
    </span>
  );
}
