const {createRobot} = require('probot')
const app = require('..')
const checkSuitePayload = require('./fixtures/check_suite.requested')
const checkRunPayload = require('./fixtures/check_run.rerequested')
const myDate = new Date(Date.UTC(2018, 0, 1))
const RealDate = Date

// Mock out the analysis implementation for these tests
// https://jestjs.io/docs/en/mock-functions#mock-implementations
jest.mock('../lib/analysis.js')
const analyzeTree = require('../lib/analysis')

describe('index', () => {
  let event
  let robot
  let github

  beforeEach(() => {
    global.Date = jest.fn(
      (...props) =>
        props.length
          ? new RealDate(...props)
          : new RealDate(myDate)
    )
    Object.assign(Date, RealDate)

    // Define event
    event = {event: 'check_suite', payload: checkSuitePayload}

    // Create robot instance
    robot = createRobot()

    // Initialize app with robot instance
    app(robot)
  
    // Mock out the GitHub API
    github = {}
    github.request = jest
      .fn()
      .mockResolvedValueOnce({data: {id: 42, url: "https://api.github.com/repos/wintron/example/check-runs/42"}})
      .mockResolvedValueOnce({data: {id: 42, url: "https://api.github.com/repos/wintron/example/check-runs/42"}})

    // Pass mocked out GitHub API into out robot instance
    robot.auth = () => Promise.resolve(github)
  })

  afterEach(() => {
    global.Date = RealDate
    analyzeTree.mockClear()
  })
  
  it('handles no annotations', async () => {
    analyzeTree.mockResolvedValue([])

    await robot.receive(event)

    expect(github.request).toHaveBeenCalledTimes(2)
    expect(github.request).toHaveBeenNthCalledWith(1, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'POST',
      url: 'https://api.github.com/repos/wintron/example/check-runs',
      name: 'feedback',
      head_sha: '9875bf915c118e6369a610770288cf7f0a415124',
      status: 'in_progress',
      started_at: '2018-01-01T00:00:00.000Z'
    })
    expect(github.request).toHaveBeenNthCalledWith(2, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'PATCH',
      url: 'https://api.github.com/repos/wintron/example/check-runs/42',
      status: 'completed',
      conclusion: 'success',
      completed_at: '2018-01-01T00:00:00.000Z'
    })

    expect(analyzeTree).toHaveBeenCalledTimes(1)
    expect(analyzeTree.mock.calls[0][0]).toBeDefined()
    expect(analyzeTree.mock.calls[0][1]).toBe('wintron')
    expect(analyzeTree.mock.calls[0][2]).toBe('example')
    expect(analyzeTree.mock.calls[0][3]).toBe('9875bf915c118e6369a610770288cf7f0a415124')
  })

  it('handles a single annotation', async () => {
    analyzeTree.mockResolvedValue([
      [{
        filename: 'FILENAME.md',
        blob_href: 'https://github.com/wintron/example/blob/ref/FILENAME.md',
        start_line: 1,
        end_line: 1,
        warning_level: 'notice',
        message: 'message',
        title: 'title'
      }]
    ])

    await robot.receive(event)

    expect(github.request).toHaveBeenCalledTimes(2)
    expect(github.request).toHaveBeenNthCalledWith(1, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'POST',
      url: 'https://api.github.com/repos/wintron/example/check-runs',
      name: 'feedback',
      head_sha: '9875bf915c118e6369a610770288cf7f0a415124',
      status: 'in_progress',
      started_at: '2018-01-01T00:00:00.000Z'
    })
    expect(github.request).toHaveBeenNthCalledWith(2, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'PATCH',
      url: 'https://api.github.com/repos/wintron/example/check-runs/42',
      status: 'completed',
      conclusion: 'neutral',
      output: {
        summary: 'Alex found 1 issue',
        title: 'analysis',
        annotations: [{
          blob_href: 'https://github.com/wintron/example/blob/ref/FILENAME.md',
          start_line: 1,
          end_line: 1,
          filename: 'FILENAME.md',
          message: 'message',
          title: 'title',
          warning_level: 'notice',
        }]
      },
      completed_at: '2018-01-01T00:00:00.000Z'
    })

    expect(analyzeTree).toHaveBeenCalledTimes(1)
  })

  it('handles multiple annotations from the same file', async () => {
    analyzeTree.mockResolvedValue([
      [{
        filename: 'FILENAME.md',
        blob_href: 'https://github.com/wintron/example/blob/ref/FILENAME.md',
        start_line: 1,
        end_line: 1,
        warning_level: 'notice',
        message: 'message',
        title: 'title'
      }, {
        filename: 'FILENAME.md',
        blob_href: 'https://github.com/wintron/example/blob/ref/FILENAME.md',
        start_line: 2,
        end_line: 2,
        warning_level: 'notice',
        message: 'message',
        title: 'title'
      }]
    ])

    await robot.receive(event)

    expect(github.request).toHaveBeenCalledTimes(2)
    expect(github.request).toHaveBeenNthCalledWith(1, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'POST',
      url: 'https://api.github.com/repos/wintron/example/check-runs',
      name: 'feedback',
      head_sha: '9875bf915c118e6369a610770288cf7f0a415124',
      status: 'in_progress',
      started_at: '2018-01-01T00:00:00.000Z'
    })
    expect(github.request).toHaveBeenNthCalledWith(2, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'PATCH',
      url: 'https://api.github.com/repos/wintron/example/check-runs/42',
      status: 'completed',
      conclusion: 'neutral',
      output: {
        summary: 'Alex found 2 issues',
        title: 'analysis',
        annotations: [{
          blob_href: 'https://github.com/wintron/example/blob/ref/FILENAME.md',
          start_line: 1,
          end_line: 1,
          filename: 'FILENAME.md',
          message: 'message',
          title: 'title',
          warning_level: 'notice',
        }, {
          blob_href: 'https://github.com/wintron/example/blob/ref/FILENAME.md',
          start_line: 2,
          end_line: 2,
          filename: 'FILENAME.md',
          message: 'message',
          title: 'title',
          warning_level: 'notice',
        }]
      },
      completed_at: '2018-01-01T00:00:00.000Z'
    })

    expect(analyzeTree).toHaveBeenCalledTimes(1)
  })

  it('handles multiple annotations across different file', async () => {
    analyzeTree.mockResolvedValue([
      [{
        filename: 'FIRST.md',
        blob_href: 'https://github.com/wintron/example/blob/ref/FIRST.md',
        start_line: 1,
        end_line: 1,
        warning_level: 'notice',
        message: 'message',
        title: 'title'
      }],
      [{
        filename: 'SECOND.md',
        blob_href: 'https://github.com/wintron/example/blob/ref/SECOND.md',
        start_line: 1,
        end_line: 1,
        warning_level: 'notice',
        message: 'message',
        title: 'title'
      }]
    ])

    await robot.receive(event)

    expect(github.request).toHaveBeenCalledTimes(2)
    expect(github.request).toHaveBeenNthCalledWith(1, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'POST',
      url: 'https://api.github.com/repos/wintron/example/check-runs',
      name: 'feedback',
      head_sha: '9875bf915c118e6369a610770288cf7f0a415124',
      status: 'in_progress',
      started_at: '2018-01-01T00:00:00.000Z'
    })
    expect(github.request).toHaveBeenNthCalledWith(2, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'PATCH',
      url: 'https://api.github.com/repos/wintron/example/check-runs/42',
      status: 'completed',
      conclusion: 'neutral',
      output: {
        summary: 'Alex found 2 issues',
        title: 'analysis',
        annotations: [{
          blob_href: 'https://github.com/wintron/example/blob/ref/FIRST.md',
          start_line: 1,
          end_line: 1,
          filename: 'FIRST.md',
          message: 'message',
          title: 'title',
          warning_level: 'notice',
        }, {
          blob_href: 'https://github.com/wintron/example/blob/ref/SECOND.md',
          start_line: 1,
          end_line: 1,
          filename: 'SECOND.md',
          message: 'message',
          title: 'title',
          warning_level: 'notice',
        }]
      },
      completed_at: '2018-01-01T00:00:00.000Z'
    })

    expect(analyzeTree).toHaveBeenCalledTimes(1)
  })

  it('handles a check_run event', async () => {
    // Override event
    event = {event: 'check_run', payload: checkRunPayload}

    analyzeTree.mockResolvedValue([])

    await robot.receive(event)

    expect(github.request).toHaveBeenCalledTimes(2)
    expect(github.request).toHaveBeenNthCalledWith(1, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'POST',
      url: 'https://api.github.com/repos/wintron/example/check-runs',
      name: 'feedback',
      head_sha: '8e86089c36bbc8018af737312e756b8c2777ef50',
      status: 'in_progress',
      started_at: '2018-01-01T00:00:00.000Z'
    })
    expect(github.request).toHaveBeenNthCalledWith(2, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'PATCH',
      url: 'https://api.github.com/repos/wintron/example/check-runs/42',
      status: 'completed',
      conclusion: 'success',
      completed_at: '2018-01-01T00:00:00.000Z'
    })

    expect(analyzeTree).toHaveBeenCalledTimes(1)
  })

  it('handles more than 50 annotations', async () => {
    let annotations = []
    const annotation = {
      filename: 'FILENAME.md',
      blob_href: 'https://github.com/wintron/example/blob/ref/FILENAME.md',
      start_line: 1,
      end_line: 1,
      warning_level: 'notice',
      message: 'message',
      title: 'title'
    }
    // I got 99 annotations...
    for (let i = 0; i < 99; i++) {
      annotations.push(annotation)
    }
    analyzeTree.mockResolvedValue([annotations])

    await robot.receive(event)

    expect(annotations.length).toBe(99)
    expect(github.request).toHaveBeenCalledTimes(3)
    expect(github.request).toHaveBeenNthCalledWith(1, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'POST',
      url: 'https://api.github.com/repos/wintron/example/check-runs',
      name: 'feedback',
      head_sha: '9875bf915c118e6369a610770288cf7f0a415124',
      status: 'in_progress',
      started_at: '2018-01-01T00:00:00.000Z'
    })
    expect(github.request).toHaveBeenNthCalledWith(2, {
      headers: {
        'accept': 'application/vnd.github.antiope-preview+json'
      },
      method: 'PATCH',
      url: 'https://api.github.com/repos/wintron/example/check-runs/42',
      status: 'completed',
      conclusion: 'neutral',
      output: {
        summary: 'Alex found 51 issues',
        title: 'analysis',
        annotations: annotations.slice(0, 50)
      },
      completed_at: '2018-01-01T00:00:00.000Z'
    })
    // expect(github.request).toHaveBeenNthCalledWith(3, {
    //   headers: {
    //     'accept': 'application/vnd.github.antiope-preview+json'
    //   },
    //   method: 'PATCH',
    //   url: 'https://api.github.com/repos/wintron/example/check-runs/42',
    //   status: 'completed',
    //   conclusion: 'neutral',
    //   output: {
    //     summary: 'Alex found 51 issues',
    //     title: 'analysis',
    //     annotations: annotations.slice(50, 51)
    //   },
    //   completed_at: '2018-01-01T00:00:00.000Z'
    // })

    expect(analyzeTree).toHaveBeenCalledTimes(1)
  })

  it('ignores other check_suite actions', async () => {
    // Override event action
    event.payload.action = 'completed'

    await robot.receive(event)

    expect(github.request).toHaveBeenCalledTimes(0)
    expect(analyzeTree).toHaveBeenCalledTimes(0)
  })
})


