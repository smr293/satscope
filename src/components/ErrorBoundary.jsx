import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass p-6 mb-6 text-center">
          <p className="text-red-400 text-sm mb-2">Something went wrong loading this section.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-btc hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
