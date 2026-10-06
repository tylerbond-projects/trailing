import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

export default function PhotoPicker({ files, onChange, max = 8 }) {
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  return (
    <div className="photo-picker">
      {previews.map((src, i) => (
        <div key={src} className="thumb">
          <img src={src} alt="" />
          <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label="Remove photo"><Icon name="close" size={12} strokeWidth={2.5} /></button>
        </div>
      ))}
      {files.length < max && (
        <label className="thumb add">
          <input type="file" accept="image/*" multiple hidden onChange={(e) => onChange([...files, ...e.target.files].slice(0, max))} />
          <span><Icon name="camera" size={22} /><small>Add photos</small></span>
        </label>
      )}
    </div>
  );
}
