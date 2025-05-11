import * as React from "react";

type ActionProps = {
  setDisplayInsightsView: (displayActionView: boolean) => void;
};

export const InsightsView = (props: ActionProps) => {

  return (
    <div className="contacts-view">
      <button onClick={ () => props.setDisplayInsightsView(false)}>back</button>

      <div className="action-card">
        <div className="action-card-content action-card-content--no-height">
          <p><b>Roland Broekema</b> birthdays is today.</p>
        </div>
        <div className="modal-close-button"></div>
      </div>
      <div className="action-card">
        <div className="action-card-content">
          <p><b>3</b> birthdays in the next 7 days.</p>
          <p><b>16</b> profile improvements possible.</p>
        </div>
        <button
          className="action-card-button"
        >Go</button>
        <div className="modal-close-button"></div>
      </div>
    </div>
  )
}
