import * as React from "react";

type ActionProps = {
  setDisplayActionsView: (displayActionView: boolean) => void;
};

export const ActionView = (props: ActionProps) => {

  return (
    <button onClick={ () => props.setDisplayActionsView(false)}>back</button>
  )
}
