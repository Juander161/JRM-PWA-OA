import React from 'react';

const TONE_CLASSNAMES = {
  success: 'badge badge-success',
  danger: 'badge badge-danger',
  warning: 'badge badge-warning',
  neutral: 'badge badge-neutral',
};

export default function Badge({ tone = 'neutral', children }) {
  return <span className={TONE_CLASSNAMES[tone] || TONE_CLASSNAMES.neutral}>{children}</span>;
}
