'use client'

import { useState } from 'react'
import { Activity, Bot, Terminal, Settings, Zap, MessageSquare, Send } from 'lucide-react'

export default function Dashboard() {
  const [prompt, setPrompt] = useState('')
  const [isBuilding, setIsBuilding] = useState(false)
  const [agents, setAgents] = useState<any[]>([])

  const handleBuildAgent = async () => {
    if (!prompt.trim()) return
    
    setIsBuilding(true)
    try {
      const response = await fetch('/api/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      
      const data = await response.json()
      if (data.success) {
        setAgents([...agents, data.agent])
        setPrompt('')
      }
    } catch (error) {
      console.error('Failed to build agent:', error)
    } finally {
      setIsBuilding(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">AGNT Station</h1>
          </div>
          <nav className="flex items-center gap-4">
            <a href="/agents" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Bot className="h-4 w-4" />
              Agents
            </a>
            <a href="/scripts" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Terminal className="h-4 w-4" />
              Scripts
            </a>
            <a href="/settings" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
              Settings
            </a>
          </nav>
        </div>
      </header>

      <main className="p-6">
        {/* Agent Builder */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Create New Agent</h2>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Describe what you want your agent to do in one sentence. AI will build everything automatically.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='Ex: "Create a TikTok agent that posts daily at 6pm, scrapes trends every morning, and sends me a WhatsApp report each evening"'
                className="flex-1 bg-background border border-border rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleBuildAgent()}
              />
              <button
                onClick={handleBuildAgent}
                disabled={isBuilding || !prompt.trim()}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {isBuilding ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin" />
                    Building...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Build Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold">{agents.filter(a => a.isActive).length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Agents</p>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{agents.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Agents</p>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground mt-1">Messages Sent</p>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cost</span>
            </div>
            <p className="text-2xl font-bold">$0.00</p>
            <p className="text-xs text-muted-foreground mt-1">Today&apos;s Cost</p>
          </div>
        </section>

        {/* Agents List */}
        {agents.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Your Agents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div key={agent.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${agent.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Bot className="h-3 w-3" />
                    <span>{agent.model}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <a
                      href={`/agents/${agent.id}`}
                      className="flex-1 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-xs font-medium hover:opacity-90 text-center"
                    >
                      Chat
                    </a>
                    <button className="flex-1 bg-background border border-border px-3 py-2 rounded-md text-xs font-medium hover:bg-secondary">
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
