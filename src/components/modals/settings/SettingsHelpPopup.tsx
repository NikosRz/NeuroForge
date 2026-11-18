'use client';

import React, { useId } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { arcadeAudio } from '@/lib/arcadeAudio';

export type SettingsHelpTopic = 'jira-token' | 'ics-calendars';

interface SettingsHelpPopupProps {
  topic: SettingsHelpTopic;
  onClose: () => void;
}

export const SettingsHelpPopup: React.FC<SettingsHelpPopupProps> = ({ topic, onClose }) => {
  const titleId = useId();

  const handleClose = (): void => {
    arcadeAudio.playUiClick();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070E]/80 backdrop-blur-[2px] p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="w-full max-w-lg bg-[#0F172A] border-2 border-cyan-400 shadow-[0_0_0_2px_#020617,0_8px_0_#020617] text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#1E293B] border-b-2 border-slate-700">
          <h3 id={titleId} className="font-pixel text-xs sm:text-sm text-cyan-300">
            {topic === 'jira-token'
              ? 'HOW TO GET A JIRA API TOKEN'
              : 'HOW TO GET PRIVATE .ICS CALENDAR LINKS'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close help popup"
            className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs sm:text-sm text-slate-200 max-h-[75vh] overflow-y-auto">
          {topic === 'jira-token' ? (
            <>
              <p className="text-slate-300">
                For <strong>JIRA Cloud</strong>, NeuroForge authenticates with your Atlassian email
                and an API Token (stored locally in SQLite only).
              </p>
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400 font-pixel text-xs text-cyan-200"
              >
                <span>Open Atlassian API Tokens Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>Sign in to your Atlassian account using the link above.</li>
                <li>Click <strong>Create API token</strong> and give it a label (e.g. <code>NeuroForge</code>).</li>
                <li>Click <strong>Create</strong>, then click <strong>Copy</strong> immediately.</li>
                <li>Paste the token into the <strong>API Token</strong> field in System Settings.</li>
                <li>
                  For <strong>JIRA Base URL</strong>, use only your root workspace domain (e.g.{' '}
                  <code className="text-cyan-300">https://your-org.atlassian.net</code>) with no board or project path.
                </li>
              </ol>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h4 className="font-pixel text-xs text-yellow-300">GOOGLE CALENDAR</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Open Google Calendar on the web and click the gear icon → <strong>Settings</strong>.</li>
                  <li>In the left sidebar under <strong>Settings for my calendars</strong>, select your calendar.</li>
                  <li>Scroll to <strong>Integrate calendar</strong>.</li>
                  <li>Copy the <strong>Secret address in iCal format</strong> (ends in <code>.ics</code>).</li>
                  <li>Paste it into the Calendars box (one URL per line for multiple calendars).</li>
                </ol>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-700">
                <h4 className="font-pixel text-xs text-yellow-300">OUTLOOK CALENDAR (WEB / OFFICE 365)</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Open Outlook on the web and click the gear icon → <strong>Calendar</strong> → <strong>Shared calendars</strong>.</li>
                  <li>Under <strong>Publish a calendar</strong>, choose your calendar and select <strong>Can view all details</strong>.</li>
                  <li>Click <strong>Publish</strong>, then copy the <strong>ICS</strong> link.</li>
                  <li>Paste the <code>.ics</code> link into System Settings and click <strong>Save Settings</strong>.</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
