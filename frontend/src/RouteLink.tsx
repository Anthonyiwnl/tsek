import type { ComponentProps } from 'react';
import { navigate } from './routing';

/** Keep normal browser semantics for new tabs, downloads and page anchors. */
export default function RouteLink({ onClick, href, ...props }: ComponentProps<'a'>) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.download || (props.target && props.target !== '_self') || !href?.startsWith('/') || href.startsWith('//') || href.includes('#')) return;
    event.preventDefault(); navigate(href);
  }} />;
}
