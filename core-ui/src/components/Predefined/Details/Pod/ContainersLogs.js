import React, { useState, useEffect, useRef } from 'react';
import { saveAs } from 'file-saver';
import {
  Button,
  LayoutPanel,
  Switch,
  Select,
  FormLabel,
} from 'fundamental-react';
import {
  useGetStream,
  useWindowTitle,
  PageHeader,
  SearchInput,
  useNotification,
} from 'react-shared';
import './ContainersLogs.scss';

const HOUR_IN_SECONDS = 3600;
const MAX_TIMEFRAME_IN_SECONDS = Number.MAX_SAFE_INTEGER;
const DEFAULT_TIMEFRAME = HOUR_IN_SECONDS * 6;

export const ContainersLogs = ({ params }) => {
  useWindowTitle('Logs');
  const notification = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [reverseLogs, setReverseLogs] = useState(false);
  const [logsToSave, setLogsToSave] = useState([]);
  const [sinceSeconds, setSinceSeconds] = useState(String(DEFAULT_TIMEFRAME));
  const selectedLogIndex = useRef(0);

  const logTimeframeOptions = [
    { text: '1 hour', key: String(HOUR_IN_SECONDS) },
    { text: '3 hours', key: String(3 * HOUR_IN_SECONDS) },
    { text: '6 hours', key: String(6 * HOUR_IN_SECONDS) },
    { text: '1 day', key: String(24 * HOUR_IN_SECONDS) },
    { text: 'all', key: String(MAX_TIMEFRAME_IN_SECONDS) },
  ];

  const breadcrumbs = [
    {
      name: 'Pods',
      path: '/',
      fromContext: 'pods',
    },
    {
      name: params.podName,
      path: '/',
      fromContext: 'pod',
    },
    { name: '' },
  ];

  const url = `/api/v1/namespaces/${params.namespace}/pods/${params.podName}/log?container=${params.containerName}&follow=true&tailLines=1000&timestamps=true&sinceSeconds=${sinceSeconds}`;
  const streamData = useGetStream(url);

  useEffect(() => {
    selectedLogIndex.current = 0;
    scrollToSelectedLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  function highlightSearch(log, searchText) {
    if (searchText) {
      const logArray = log.split(new RegExp(`(${searchText})`, 'gi'));
      return (
        <span>
          {logArray.map((part, idx) =>
            part.toLowerCase() === searchText.toLowerCase() ? (
              <b key={idx} className="logs-highlighted">
                {part}
              </b>
            ) : (
              part
            ),
          )}
        </span>
      );
    }
    return <span>{log}</span>;
  }

  const scrollToSelectedLog = () => {
    const highlightedLogs = document.getElementsByClassName('logs-highlighted');
    if (selectedLogIndex.current < 0) {
      selectedLogIndex.current = highlightedLogs?.length - 1 || 0;
    } else if (selectedLogIndex.current > highlightedLogs?.length - 1) {
      selectedLogIndex.current = 0;
    }
    const selectedLog = highlightedLogs[selectedLogIndex.current];
    if (selectedLog) {
      selectedLog.scrollIntoView();
    }
  };

  const changeSelectedLog = e => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      selectedLogIndex.current = selectedLogIndex.current + 1;
      scrollToSelectedLog();
    } else if (e.key === 'ArrowUp') {
      selectedLogIndex.current = selectedLogIndex.current - 1;
      scrollToSelectedLog();
    }
  };

  const onSwitchChange = () => {
    setShowTimestamps(prev => !prev);
  };

  const onReverseChange = () => {
    setReverseLogs(prev => !prev);
  };

  const onLogTimeframeChange = timeValue => {
    setSinceSeconds(timeValue);
  };

  const saveToFile = (podName, containerName) => {
    const dateObj = new Date();
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    const hour = dateObj.getHours();
    const minute = dateObj.getMinutes();
    const date = `${day}-${month}-${year}-${hour}-${minute}`;

    try {
      const file = new Blob(
        logsToSave.map(log => `${log}\n`),
        { type: 'text/plain' },
      );
      saveAs(file, `${podName}-${containerName}-${date}.txt`);
    } catch (e) {
      console.error(e);
      notification.notifyError({
        title: 'Failed to download the Logs',
        content: e.message,
      });
    }
  };

  const LogsPanel = ({ streamData, containerName }) => {
    const { error, data } = streamData;
    if (error) return <div className="empty-logs">{error.message}</div>;
    setLogsToSave(data || []);

    if (data.length === 0)
      return (
        <div className="empty-logs">
          No logs avaliable for the '{containerName}' container.
        </div>
      );

    const newData = reverseLogs ? [...data].reverse() : [...data];

    return newData.map((arr, idx) => {
      const timestamp = arr.split(' ')[0];
      const stream = arr.replace(timestamp, '');
      const log = showTimestamps ? `${timestamp} ${stream}` : stream;
      const highlightedLog = highlightSearch(log, searchQuery);
      return (
        <div className="logs" key={idx}>
          {highlightedLog}
        </div>
      );
    });
  };

  return (
    <div className="logs-wraper">
      <div className="logs-header">
        <PageHeader
          title={params.containerName}
          breadcrumbItems={breadcrumbs}
        ></PageHeader>
      </div>
      <LayoutPanel className="fd-margin--md logs-panel">
        <LayoutPanel.Header>
          <LayoutPanel.Head title="Logs" className="logs-title" />
          <LayoutPanel.Actions className="logs-actions">
            <FormLabel htmlFor="context-chooser">
              Filter timeframe by:
            </FormLabel>
            <Select
              options={logTimeframeOptions}
              placeholder="all"
              compact
              selectedKey={sinceSeconds.toString()}
              onSelect={(_, { key }) => onLogTimeframeChange(key)}
            />
            <Switch
              disabled={!logsToSave?.length}
              compact
              onChange={onSwitchChange}
            >
              Show timestamps
            </Switch>
            <Switch
              disabled={!logsToSave?.length}
              compact
              onChange={onReverseChange}
            >
              Reverse logs
            </Switch>
            <Button
              disabled={!logsToSave?.length}
              className="logs-download"
              onClick={() => saveToFile(params.podName, params.containerName)}
            >
              Save to a file
            </Button>
            <SearchInput
              disabled={!logsToSave?.length}
              entriesKind={'Logs'}
              searchQuery={searchQuery}
              handleQueryChange={setSearchQuery}
              showSuggestion={false}
              onKeyDown={changeSelectedLog}
            />
          </LayoutPanel.Actions>
        </LayoutPanel.Header>
        <LayoutPanel.Body className="logs-panel-body">
          <LogsPanel
            streamData={streamData}
            containerName={params.containerName}
          />
        </LayoutPanel.Body>
      </LayoutPanel>
    </div>
  );
};
