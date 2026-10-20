import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  /** What failed, in the reader's words: "this figure", "this page". */
  what: string;
  children: ReactNode;
}

/** Keeps one broken figure (or page) from blanking the whole site. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Error in ${this.props.what}:`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.box} role="alert">
        <p>
          <b>Sorry, {this.props.what} hit an unexpected error.</b> The rest of the page still works.
        </p>
        <button type="button" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
